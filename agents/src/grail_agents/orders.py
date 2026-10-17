"""Guarded spot execution; the default path never invokes the write boundary."""
from copy import deepcopy
from decimal import Decimal, ROUND_DOWN
from threading import RLock

from .atk import validate_client_id
from .config import AgentConfig, GrailError, money, number, spot_id
from .market import normalize_portfolio, normalize_ticker, validate_instruments


def _floor(value, step):
    return (value / step).to_integral_value(rounding=ROUND_DOWN) * step


class OrderService:
    def __init__(self, client, config: AgentConfig, instruments, *, journal=None):
        self.client = client
        self.config = config
        self.instruments = validate_instruments(list(instruments.values()), config.coins)
        self.journal = journal
        self._simulated = {}
        self._lock = RLock()

    def _intent(self, decision, client_order_id, order_type, limit_price):
        cfg = self.config
        validate_client_id(client_order_id)
        inst = spot_id(decision.get("inst_id"))
        if inst not in cfg.coins:
            raise GrailError("COIN_ALLOWLIST: instrument is not configured")
        if decision.get("dry_run", cfg.dry_run) is not cfg.dry_run:
            raise GrailError("DRY_RUN_MISMATCH: decision and active config differ")
        if decision.get("mode", "live") != "live":
            raise GrailError("MODE_MISMATCH: expected live account context")
        if decision.get("action") not in {"BUY", "SELL"} or order_type not in {"market", "limit"}:
            raise GrailError("SPOT_ONLY: BUY/SELL market/limit required; HOLD needs no order")
        amount = number(decision.get("size_usdt"), "size_usdt", positive=True)
        reference = number(decision.get("ref_price"), "ref_price", positive=True)
        if not cfg.min_order_usdt <= amount <= cfg.max_order_usdt:
            raise GrailError("ORDER_LIMIT: size is outside configured order limits")
        price = number(limit_price, "limit_price", positive=True) if order_type == "limit" else None
        if order_type == "market" and limit_price is not None:
            raise GrailError("ORDER_PRICE: market order cannot have a limit price")
        return {"inst_id": inst, "action": decision["action"], "size_usdt": money(amount), "ref_price": money(reference), "order_type": order_type, "price": money(price) if price else None, "dry_run": cfg.dry_run}

    def _prepare(self, intent, client_order_id):
        rule = self.instruments[intent["inst_id"]]
        amount = number(intent["size_usdt"], "size")
        price = number(intent["price"] or intent["ref_price"], "price", positive=True)
        tick = number(rule["tickSz"], "tick", positive=True)
        if intent["order_type"] == "limit" and price % tick:
            raise GrailError("PRICE_TICK: limit price is not a tick multiple")
        lot = number(rule["lotSz"], "lot", positive=True)
        base = _floor(amount / price, lot)
        if base < number(rule["minSz"], "minimum", positive=True):
            raise GrailError("MIN_SIZE: order is below the exchange base minimum")
        quote_buy = intent["action"] == "BUY" and intent["order_type"] == "market"
        notional = amount if quote_buy else base * price
        if notional < self.config.min_order_usdt:
            raise GrailError("MIN_SIZE: rounded notional is below configured minimum")
        return {**intent, "client_order_id": client_order_id, "size": money(amount if quote_buy else base), "tgt_ccy": "quote_ccy" if quote_buy else "base_ccy", "size_base": money(base), "size_usdt": money(notional)}

    def _guard(self, prepared, portfolio, records, kill_switch):
        cfg = self.config
        equity = number(portfolio.get("equity_usdt"), "equity_usdt")
        cash = number(portfolio.get("cash_usdt"), "cash_usdt")
        peak = number(portfolio.get("peak_equity_usdt", equity), "peak_equity_usdt")
        if kill_switch is not False or (peak and (peak - equity) / peak * 100 >= cfg.kill_switch_drawdown_pct):
            raise GrailError("KILL_SWITCH: orders disabled")
        positions = portfolio.get("positions")
        if not isinstance(positions, list):
            raise GrailError("PORTFOLIO: positions must be a list")
        deployed = sum((number(p.get("value_usdt"), "position value") for p in positions), Decimal(0))
        active = [r["prepared"] for r in records if r["result"]["order_status"] not in {"filled", "canceled", "rejected"}]
        reserved = sum((number(p["size_usdt"], "reservation") for p in active if p["action"] == "BUY"), Decimal(0))
        size = number(prepared["size_usdt"], "size")
        if prepared["action"] == "BUY":
            if deployed + reserved + size > cfg.max_total_deploy_usdt:
                raise GrailError("DEPLOY_LIMIT: total holdings and reservations exceed configured maximum")
            if reserved + size > cash:
                raise GrailError("CASH_BALANCE: insufficient available USDT after reservations")
        else:
            same = [p for p in positions if p.get("inst_id") == prepared["inst_id"]]
            if len(same) > 1:
                raise GrailError("PORTFOLIO: duplicate position")
            available = number(same[0].get("available_base", same[0].get("size_base")), "available base") if same else Decimal(0)
            reserved_base = sum((number(p["size_base"], "reserved base") for p in active if p["action"] == "SELL" and p["inst_id"] == prepared["inst_id"]), Decimal(0))
            if number(prepared["size_base"], "size base") + reserved_base > available:
                raise GrailError("BASE_BALANCE: insufficient unreserved spot balance")

    def _query_record(self, record):
        prepared = record["prepared"]
        try:
            result = self.client.order_status(prepared["inst_id"], prepared["client_order_id"])
        except GrailError:
            result = {**record["result"], "order_status": "unknown"}
        self.journal.save_result(prepared["client_order_id"], result)
        return result

    def query(self, client_order_id):
        """Reconcile an existing durable record; never submit or retry an order."""
        validate_client_id(client_order_id)
        if self.journal is None:
            raise GrailError("JOURNAL_REQUIRED: reconciliation needs a durable journal")
        record = self.journal.get(client_order_id)
        if record is None:
            raise GrailError("JOURNAL_MISSING: unknown client order ID")
        return self._query_record(record)

    def execute(self, decision, portfolio, *, client_order_id, order_type="market", limit_price=None, kill_switch=False, live_confirmed=False):
        with self._lock:
            intent = self._intent(decision, client_order_id, order_type, limit_price)
            if self.config.dry_run:
                existing = self._simulated.get(client_order_id)
                if existing:
                    if existing["intent"] != intent:
                        raise GrailError("ORDER_ID_REUSED: client ID belongs to a different intent")
                    return deepcopy(existing["result"])
                prepared = self._prepare(intent, client_order_id)
                self._guard(prepared, portfolio, list(self._simulated.values()), kill_switch)
                result = {"client_order_id": client_order_id, "okx_order_id": None, "order_status": "simulated", "fill_price": None, "inst_id": prepared["inst_id"], "action": prepared["action"], "size_base": prepared["size_base"], "size_usdt": prepared["size_usdt"]}
                self._simulated[client_order_id] = {"intent": intent, "prepared": prepared, "result": result}
                return deepcopy(result)
            if live_confirmed is not True:
                raise GrailError("LIVE_CONFIRMATION: user must explicitly enable and confirm live trading")
            if self.journal is None:
                raise GrailError("JOURNAL_REQUIRED: live orders require a persistent client-ID journal")
            existing = self.journal.get(client_order_id)
            if existing:
                if existing["intent"] != intent:
                    raise GrailError("ORDER_ID_REUSED: client ID belongs to a different intent")
                return self._query_record(existing)
            # Resolve uncertainty before any new intent. Never retry even if lookup is empty.
            for record in self.journal.records():
                if record["result"]["order_status"] == "unknown":
                    if self._query_record(record)["order_status"] == "unknown":
                        raise GrailError("UNCERTAIN_ORDER: reconcile existing client ID before another order")
            self.instruments = validate_instruments(self.client.instruments(), self.config.coins)
            prices = {inst: normalize_ticker(self.client.ticker(inst))["last"] for inst in self.config.coins}
            fresh = normalize_portfolio(self.client.balance(), prices)
            # A peak is required for live orders; the caller owns durable peak tracking (T-006).
            fresh["peak_equity_usdt"] = money(number(portfolio.get("peak_equity_usdt"), "peak_equity_usdt", positive=True))
            prepared = self._prepare(intent, client_order_id)
            unknown = {"client_order_id": client_order_id, "okx_order_id": None, "order_status": "unknown", "fill_price": None}
            with self.journal.transaction() as session:
                if session.get(client_order_id) is not None:
                    raise GrailError("ORDER_ID_BUSY: another worker claimed this intent; query it")
                records = session.records()
                if any(r["result"]["order_status"] == "unknown" for r in records):
                    raise GrailError("UNCERTAIN_ORDER: another unresolved submission exists")
                self._guard(prepared, fresh, records, kill_switch)
                session.save(client_order_id, {"intent": intent, "prepared": prepared, "result": unknown})
            # The transaction is committed BEFORE the external effect. A crash remains unknown.
            try:
                result = self.client._place_spot(prepared)
            except GrailError:
                return self.query(client_order_id)
            self.journal.save_result(client_order_id, result)
            return result
