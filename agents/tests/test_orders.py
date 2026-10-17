import pytest

from grail_agents.config import AgentConfig, GrailError, OrderRejected
from grail_agents.journal import OrderJournal
from grail_agents.orders import OrderService


class Exchange:
    """Only the exchange boundary is replaced; guards/journal/conversions are real."""
    def __init__(self, rule):
        self.rule = rule
        self.placed = []
        self.queried = []
        self.submit_error = False
        self.query_result = {"client_order_id": "g1", "okx_order_id": "42", "order_status": "pending", "fill_price": None}

    def instruments(self):
        return [self.rule]

    def ticker(self, inst):
        return {"instId": inst, "last": "60000", "open24h": "60000", "ts": "1000"}

    def balance(self):
        return [{"details": [{"ccy": "USDT", "cashBal": "100", "availBal": "100"}]}]

    def open_orders(self):
        return []

    def _place_spot(self, prepared):
        self.placed.append(prepared)
        if self.submit_error:
            raise GrailError("ATK_TIMEOUT")
        return {"client_order_id": prepared["client_order_id"], "okx_order_id": "42", "order_status": "pending", "fill_price": None}

    def order_status(self, inst, client_order_id):
        self.queried.append((inst, client_order_id))
        return {**self.query_result, "client_order_id": client_order_id}


@pytest.fixture
def setup_order(cfg_dict, instrument_row):
    cfg_dict["coins"] = ["BTC-USDT"]
    exchange = Exchange(instrument_row)
    portfolio = {"equity_usdt": "100", "peak_equity_usdt": "100", "cash_usdt": "100", "positions": []}
    decision = {"inst_id": "BTC-USDT", "action": "BUY", "size_usdt": "5", "ref_price": "60000", "dry_run": True}
    return cfg_dict, exchange, portfolio, decision


def service(setup_order, **kwargs):
    cfg, exchange, _, _ = setup_order
    return OrderService(exchange, AgentConfig.from_mapping(cfg), {"BTC-USDT": exchange.rule}, **kwargs)


def test_dry_run_returns_simulated_without_placing(setup_order):
    cfg, exchange, portfolio, decision = setup_order
    result = service(setup_order).execute(decision, portfolio, client_order_id="g1")
    assert result["order_status"] == "simulated"
    assert result["okx_order_id"] is None and result["fill_price"] is None
    assert exchange.placed == []


@pytest.mark.parametrize("change", [{"inst_id": "DOGE-USDT"}, {"inst_id": "BTC-USDT-SWAP"}, {"size_usdt": "10.01"}, {"size_usdt": "1"}, {"size_usdt": "0"}, {"size_usdt": "-1"}, {"size_usdt": "NaN"}, {"ref_price": "NaN"}, {"action": "LONG"}, {"dry_run": False}])
def test_bad_intent_is_blocked_before_place(setup_order, change):
    _, exchange, portfolio, decision = setup_order
    decision.update(change)
    with pytest.raises(GrailError):
        service(setup_order).execute(decision, portfolio, client_order_id="g1")
    assert exchange.placed == []


@pytest.mark.parametrize("kwargs", [{"kill_switch": True}, {"order_type": "margin"}, {"order_type": "limit"}, {"order_type": "limit", "limit_price": "60000.01"}, {"client_order_id": "bad-id"}])
def test_bad_order_parameters_never_place(setup_order, kwargs):
    _, exchange, portfolio, decision = setup_order
    with pytest.raises(GrailError):
        service(setup_order).execute(decision, portfolio, **({"client_order_id": "g1"} | kwargs))
    assert exchange.placed == []


def test_drawdown_at_threshold_blocks(setup_order):
    _, exchange, portfolio, decision = setup_order
    portfolio["equity_usdt"] = "95"
    with pytest.raises(GrailError, match="KILL_SWITCH"):
        service(setup_order).execute(decision, portfolio, client_order_id="g1")
    assert exchange.placed == []


@pytest.mark.parametrize("field,value", [("cash_usdt", "4"), ("equity_usdt", "NaN")])
def test_insufficient_or_invalid_account_blocks(setup_order, field, value):
    _, exchange, portfolio, decision = setup_order
    portfolio[field] = value
    with pytest.raises(GrailError):
        service(setup_order).execute(decision, portfolio, client_order_id="g1")
    assert exchange.placed == []


def test_total_deployed_accounts_for_all_positions(setup_order):
    _, exchange, portfolio, decision = setup_order
    portfolio["positions"] = [{"inst_id": "ETH-USDT", "value_usdt": "46", "size_base": "1"}]
    with pytest.raises(GrailError, match="DEPLOY_LIMIT"):
        service(setup_order).execute(decision, portfolio, client_order_id="g1")
    assert exchange.placed == []


def test_sequential_simulations_reserve_budget(setup_order):
    cfg, exchange, portfolio, decision = setup_order
    cfg["max_total_deploy_usdt"] = "10"
    svc = service(setup_order)
    assert svc.execute(decision, portfolio, client_order_id="g1")["order_status"] == "simulated"
    svc.execute(decision, portfolio, client_order_id="g2")
    with pytest.raises(GrailError, match="DEPLOY_LIMIT"):
        svc.execute(decision, portfolio, client_order_id="g3")
    assert exchange.placed == []


def test_repeat_same_client_id_is_idempotent_and_changed_intent_rejected(setup_order):
    _, _, portfolio, decision = setup_order
    svc = service(setup_order)
    first = svc.execute(decision, portfolio, client_order_id="g1")
    assert svc.execute(decision, portfolio, client_order_id="g1") == first
    with pytest.raises(GrailError, match="ORDER_ID_REUSED"):
        svc.execute({**decision, "size_usdt": "6"}, portfolio, client_order_id="g1")


def test_sell_cannot_exceed_available_base(setup_order):
    _, exchange, portfolio, decision = setup_order
    decision["action"] = "SELL"
    portfolio["positions"] = [{"inst_id": "BTC-USDT", "value_usdt": "60", "size_base": "0.001", "available_base": "0.00001"}]
    with pytest.raises(GrailError, match="BASE_BALANCE"):
        service(setup_order).execute(decision, portfolio, client_order_id="g1")
    assert exchange.placed == []


def test_limit_size_rounds_down_to_lot_without_exceeding_budget(setup_order):
    _, _, portfolio, decision = setup_order
    result = service(setup_order).execute(decision, portfolio, client_order_id="g1", order_type="limit", limit_price="60000")
    assert result["size_base"] == "0.00008"
    assert result["size_usdt"] == "4.8"


def test_exchange_minimum_checked_even_in_simulation(setup_order):
    _, exchange, portfolio, decision = setup_order
    exchange.rule["minSz"] = "0.001"
    with pytest.raises(GrailError, match="MIN_SIZE"):
        service(setup_order).execute(decision, portfolio, client_order_id="g1")
    assert exchange.placed == []


def test_live_needs_config_and_explicit_confirmation_and_journal(setup_order, tmp_path):
    cfg, exchange, portfolio, decision = setup_order
    cfg["dry_run"] = decision["dry_run"] = False
    with pytest.raises(GrailError, match="LIVE_CONFIRMATION"):
        service(setup_order, journal=OrderJournal(tmp_path / "orders.sqlite3")).execute(decision, portfolio, client_order_id="g1")
    with pytest.raises(GrailError, match="JOURNAL_REQUIRED"):
        service(setup_order).execute(decision, portfolio, client_order_id="g1", live_confirmed=True)
    assert exchange.placed == []


def test_live_refreshes_balance_before_enforcing_limits(setup_order, tmp_path):
    cfg, exchange, portfolio, decision = setup_order
    cfg["dry_run"] = decision["dry_run"] = False
    exchange.balance = lambda: [{"details": [{"ccy": "USDT", "cashBal": "100", "availBal": "1"}]}]
    with pytest.raises(GrailError, match="CASH_BALANCE"):
        service(setup_order, journal=OrderJournal(tmp_path / "orders.sqlite3")).execute(decision, portfolio, client_order_id="g1", live_confirmed=True)
    assert exchange.placed == []


def test_timeout_queries_id_and_restart_never_resubmits(setup_order, tmp_path):
    cfg, exchange, portfolio, decision = setup_order
    cfg["dry_run"] = decision["dry_run"] = False
    exchange.submit_error = True
    journal = OrderJournal(tmp_path / "orders.sqlite3")
    svc = service(setup_order, journal=journal)
    result = svc.execute(decision, portfolio, client_order_id="g1", live_confirmed=True)
    assert result["order_status"] == "pending" and result["okx_order_id"] == "42"
    assert exchange.queried == [("BTC-USDT", "g1")]
    restarted = service(setup_order, journal=OrderJournal(tmp_path / "orders.sqlite3"))
    assert restarted.execute(decision, portfolio, client_order_id="g1", live_confirmed=True)["okx_order_id"] == "42"
    assert len(exchange.placed) == 1


def test_unresolved_order_blocks_new_intents_and_reserves_across_restart(setup_order, tmp_path):
    cfg, exchange, portfolio, decision = setup_order
    cfg["dry_run"] = decision["dry_run"] = False
    exchange.submit_error = True
    exchange.query_result["order_status"] = "unknown"
    path = tmp_path / "orders.sqlite3"
    assert service(setup_order, journal=OrderJournal(path)).execute(decision, portfolio, client_order_id="g1", live_confirmed=True)["order_status"] == "unknown"
    with pytest.raises(GrailError, match="UNCERTAIN_ORDER"):
        service(setup_order, journal=OrderJournal(path)).execute(decision, portfolio, client_order_id="g2", live_confirmed=True)
    assert len(exchange.placed) == 1


def test_live_pending_orders_reserve_remaining_deploy_budget(setup_order, tmp_path):
    cfg, exchange, portfolio, decision = setup_order
    cfg["dry_run"] = decision["dry_run"] = False
    cfg["max_total_deploy_usdt"] = "10"
    svc = service(setup_order, journal=OrderJournal(tmp_path / "orders.sqlite3"))
    svc.execute(decision, portfolio, client_order_id="g1", live_confirmed=True)
    svc.execute(decision, portfolio, client_order_id="g2", live_confirmed=True)
    with pytest.raises(GrailError, match="DEPLOY_LIMIT"):
        svc.execute(decision, portfolio, client_order_id="g3", live_confirmed=True)
    assert len(exchange.placed) == 2


def test_journal_is_committed_before_exchange_submission(setup_order, tmp_path):
    cfg, exchange, portfolio, decision = setup_order
    cfg["dry_run"] = decision["dry_run"] = False
    path = tmp_path / "orders.sqlite3"
    def crash(prepared):
        assert OrderJournal(path).get("g1")["result"]["order_status"] == "unknown"
        raise SystemExit("simulated crash")
    exchange._place_spot = crash
    with pytest.raises(SystemExit):
        service(setup_order, journal=OrderJournal(path)).execute(decision, portfolio, client_order_id="g1", live_confirmed=True)
    assert service(setup_order, journal=OrderJournal(path)).execute(decision, portfolio, client_order_id="g1", live_confirmed=True)["order_status"] == "pending"


def test_untracked_open_order_blocks_new_live_order(setup_order, tmp_path):
    cfg, exchange, portfolio, decision = setup_order
    cfg["dry_run"] = decision["dry_run"] = False
    exchange.open_orders = lambda: [{"instId": "BTC-USDT", "clOrdId": "otherAgent", "ordId": "7"}]
    with pytest.raises(GrailError, match="UNTRACKED_ORDERS"):
        service(setup_order, journal=OrderJournal(tmp_path / "orders.sqlite3")).execute(decision, portfolio, client_order_id="g1", live_confirmed=True)
    assert exchange.placed == []


def test_balance_refresh_and_budget_claim_are_serialized(setup_order, tmp_path):
    import sqlite3
    cfg, exchange, portfolio, decision = setup_order
    cfg["dry_run"] = decision["dry_run"] = False
    path = tmp_path / "orders.sqlite3"
    svc = service(setup_order, journal=OrderJournal(path))
    original_balance = exchange.balance
    def balance_during_claim():
        # A concurrent reconciler must not release a reservation against an older snapshot.
        with sqlite3.connect(path, timeout=0) as concurrent:
            with pytest.raises(sqlite3.OperationalError, match="locked"):
                concurrent.execute("BEGIN IMMEDIATE")
        return original_balance()
    exchange.balance = balance_during_claim
    assert svc.execute(decision, portfolio, client_order_id="g1", live_confirmed=True)["order_status"] == "pending"


def test_definite_rejection_is_terminal_and_next_order_can_execute(setup_order, tmp_path):
    cfg, exchange, portfolio, decision = setup_order
    cfg["dry_run"] = decision["dry_run"] = False
    original = exchange._place_spot
    def reject_once(prepared):
        if prepared["client_order_id"] == "g1":
            raise OrderRejected("51008")
        return original(prepared)
    exchange._place_spot = reject_once
    svc = service(setup_order, journal=OrderJournal(tmp_path / "orders.sqlite3"))
    assert svc.execute(decision, portfolio, client_order_id="g1", live_confirmed=True)["order_status"] == "rejected"
    assert svc.query("g1")["rejection_code"] == "51008"
    assert exchange.queried == []
    assert svc.execute(decision, portfolio, client_order_id="g2", live_confirmed=True)["order_status"] == "pending"


@pytest.mark.parametrize("prior_state", ["pending", "partial"])
def test_filled_orders_are_reconciled_before_next_budget_check(setup_order, tmp_path, prior_state):
    cfg, exchange, portfolio, decision = setup_order
    cfg["dry_run"] = decision["dry_run"] = False
    decision["size_usdt"] = "10"
    portfolio["peak_equity_usdt"] = "29.4"
    exchange.balance = lambda: [{"details": [{"ccy": "USDT", "cashBal": "29.4", "availBal": "29.4"}]}]
    svc = service(setup_order, journal=OrderJournal(tmp_path / "orders.sqlite3"))
    svc.execute(decision, portfolio, client_order_id="g1", live_confirmed=True)
    record = svc.journal.get("g1")
    svc.journal.save_result("g1", {**record["result"], "order_status": prior_state})
    exchange.query_result["order_status"] = "filled"
    exchange.balance = lambda: [{"details": [{"ccy": "USDT", "cashBal": "19.4", "availBal": "19.4"}, {"ccy": "BTC", "cashBal": "0.00016666", "availBal": "0.00016666"}]}]
    assert svc.execute(decision, portfolio, client_order_id="g2", live_confirmed=True)["order_status"] == "pending"
    assert exchange.queried == [("BTC-USDT", "g1")]
