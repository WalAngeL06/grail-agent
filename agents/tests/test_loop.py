from copy import deepcopy
import json
import time

import pytest

from grail_agents.chain import SimulatedChain
from grail_agents.config import AgentConfig, GrailError
from grail_agents.loop import AgentLoop
from grail_agents.orders import OrderService
from grail_agents.payload import commitment
from grail_agents.storage import CycleStore


class Market:
    def __init__(self, coins):
        self.coins = coins
        self.queries = []
        self.fail_reads = False

    def instruments(self):
        if self.fail_reads:
            raise RuntimeError("secret-provider-key")
        return [{"instId": coin, "instType": "SPOT", "state": "live", "baseCcy": coin.split("-")[0], "quoteCcy": "USDT", "minSz": "0.01", "lotSz": "0.01", "tickSz": "0.01"} for coin in self.coins]

    def ticker(self, inst):
        return {"instId": inst, "last": "100", "open24h": "100", "ts": "1792234800000"}

    def balance(self):
        return [{"details": [{"ccy": "USDT", "cashBal": "80", "availBal": "80"}, {"ccy": "ETH", "cashBal": "0.2", "availBal": "0.2"}]}]

    def candles(self, inst, bar, limit):
        return [[str(1792234800000 - (limit - i) * 3600000), "80", "101", "70", str(80 + i * 0.3 + (i % 3) * 0.2), "1", "100", "100", "1"] for i in range(limit)]

    def _place_spot(self, prepared):
        raise AssertionError("dry-run loop must never send a real order")

    def order_status(self, inst, client_order_id):
        self.queries.append((inst, client_order_id))
        return {"client_order_id": client_order_id, "okx_order_id": None, "order_status": "unknown", "fill_price": None}


class ObservedChain(SimulatedChain):
    def __init__(self, root, events):
        super().__init__(root / "fake-chain.json")
        self.root = root
        self.events = events
        self.fail_commit = False
        self.fail_reveal = False
        self.crash_after_commit = False

    def commit(self, cycle_id, digest):
        pending = json.loads((self.root / f"pending/{cycle_id}.json").read_text())
        assert pending["commit_hash"] == digest
        assert commitment(pending["payload_utf8"], pending["salt_hex"]) == digest
        self.events.append("commit")
        if self.fail_commit:
            raise GrailError("CHAIN_COMMIT_FAILED")
        result = super().commit(cycle_id, digest)
        if self.crash_after_commit:
            raise SystemExit("crash after mined commit, before saving receipt")
        return result

    def reveal(self, cycle_id, payload, salt, orders):
        self.events.append("reveal")
        if self.fail_reveal:
            raise GrailError("CHAIN_REVEAL_FAILED")
        return super().reveal(cycle_id, payload, salt, orders)


class ObservedOrders(OrderService):
    def __init__(self, client, cfg, events):
        super().__init__(client, AgentConfig.from_mapping(cfg), {r["instId"]: r for r in client.instruments()})
        self.events = events
        self.seen = []

    def execute(self, decision, portfolio, **kwargs):
        self.events.append("execute")
        self.seen.append(deepcopy(decision))
        return super().execute(decision, portfolio, **kwargs)


def fixed_decide(snapshot, portfolio, cfg):
    actions = {"BTC-USDT": ("BUY", "5"), "ETH-USDT": ("SELL", "5"), "SOL-USDT": ("HOLD", "0")}
    decisions = [{"cycle_id": snapshot["cycle_id"], "agent": cfg["agent_name"], "mode": "live", "dry_run": True, "inst_id": inst, "action": actions[inst][0], "size_usdt": actions[inst][1], "ref_price": "100", "target_weight_pct": 10, "reason": "test", "decided_at_ms": snapshot["at_ms"]} for inst in cfg["coins"]]
    return {"ok": True, "payload": {"cycle_id": snapshot["cycle_id"], "agent": cfg["agent_name"], "mode": "live", "dry_run": True, "decided_at_ms": snapshot["at_ms"], "decisions": decisions}, "metrics": {"n_assets": len(decisions)}, "errors": []}


@pytest.fixture
def rig(cfg_dict, tmp_path):
    cfg_dict["coins"] = ["BTC-USDT", "ETH-USDT", "SOL-USDT"]
    client = Market(cfg_dict["coins"])
    events = []
    chain = ObservedChain(tmp_path, events)
    orders = ObservedOrders(client, cfg_dict, events)
    def create(**kwargs):
        return AgentLoop(cfg_dict, client, chain, tmp_path, orders=orders, clock=lambda: 1792234800000, decide_fn=fixed_decide, **kwargs)
    return cfg_dict, client, chain, orders, events, create


def test_final_analyst_reduction_is_committed_executed_and_revealed_unchanged(rig):
    cfg, _, chain, orders, events, create = rig
    def provider(prompt, timeout):
        return json.dumps({"reviews": [{"inst_id": "BTC-USDT", "action": "BUY", "size_usdt": "2", "note": "reduce"}, {"inst_id": "ETH-USDT", "action": "HOLD", "note": "must not veto sell"}]})
    state = create(provider=provider).run_once()
    assert events == ["commit", "execute", "execute", "reveal"]
    final = json.loads(chain.lookup(1)["payload_utf8"])
    by_coin = {d["inst_id"]: d for d in final["decisions"]}
    assert by_coin["BTC-USDT"]["size_usdt"] == "2.00"
    assert by_coin["BTC-USDT"]["llm_flag"] == "reduced"
    assert by_coin["ETH-USDT"]["action"] == "SELL" and by_coin["ETH-USDT"]["size_usdt"] == "5"
    assert by_coin["ETH-USDT"]["llm_flag"] == "exempt"
    assert orders.seen == [by_coin["BTC-USDT"], by_coin["ETH-USDT"]]
    assert len(state["decisions"]) == 3 and "ledger" not in state
    for decision in state["decisions"]:
        assert commitment(decision["payload_utf8"], decision["salt_hex"]) == decision["commit_hash"]
        assert decision["verified"] is False  # a simulated chain is never a Fuji verification
        assert all(decision[key] == value for key, value in by_coin[decision["inst_id"]].items())
    assert state["chain"]["agent_id"] is None and state["chain"]["identity_registry"] is None
    assert state["config"]["max_order_usdt"] == cfg["max_order_usdt"]


def test_vetoed_buy_is_hold_and_gets_no_order(rig):
    _, _, chain, orders, _, create = rig
    state = create(provider=lambda *_: '{"reviews":[{"inst_id":"BTC-USDT","action":"HOLD","note":"veto"}]}').run_once()
    assert [d["action"] for d in orders.seen] == ["SELL"]
    assert next(d for d in state["decisions"] if d["inst_id"] == "BTC-USDT")["llm_flag"] == "vetoed"
    assert chain.info()["reveals"] == 1


@pytest.mark.parametrize("kind", ["none", "timeout", "bad_json"])
def test_missing_or_failed_provider_keeps_loop_running(rig, kind):
    cfg, _, chain, _, _, create = rig
    cfg["llm_timeout_s"] = 0.001
    def provider(*_):
        if kind == "timeout":
            time.sleep(0.02)
        return "bad json"
    state = create(provider=None if kind == "none" else provider).run_once()
    btc = next(d for d in state["decisions"] if d["inst_id"] == "BTC-USDT")
    assert btc["llm_flag"] == "skipped" and btc["size_usdt"] == "5"
    assert chain.info()["reveals"] == 1


def test_commit_failure_never_executes_and_next_cycle_continues(rig):
    _, _, chain, orders, _, create = rig
    loop = create()
    chain.fail_commit = True
    state = loop.run_once()
    assert orders.seen == [] and state["errors"]
    assert CycleStore(chain.root).pending()[0]["cycle_id"] == 1
    chain.fail_commit = False
    assert loop.run_once()["agent"]["cycle_id"] == 2
    assert chain.lookup(1) is None and chain.lookup(2)["revealed"]


def test_crash_after_commit_reveals_record_without_recommit_order_or_analyst(rig):
    _, client, chain, orders, events, create = rig
    chain.crash_after_commit = True
    with pytest.raises(SystemExit):
        create().run_once()
    pending_before = CycleStore(chain.root).pending()[0]
    chain.crash_after_commit = False
    events.clear()
    def must_not_review(*_):
        raise AssertionError("recovery must not call analyst")
    recovered = create(provider=must_not_review).recover()
    record = chain.lookup(1)
    assert record["payload_utf8"] == pending_before["payload_utf8"]
    assert record["salt_hex"] == pending_before["salt_hex"]
    assert events == ["reveal"] and orders.seen == []
    assert CycleStore(chain.root).pending() == []
    assert recovered["chain"]["reveals"] == 1
    assert all(d["okx_order_id"] is None for d in recovered["decisions"])


def test_reveal_failure_retains_pending_and_recovery_does_not_repeat_execution(rig):
    _, _, chain, orders, events, create = rig
    chain.fail_reveal = True
    first = create()
    state = first.run_once()
    pending = CycleStore(chain.root).pending()[0]
    assert state["decisions"] == []  # private salt is not published before reveal
    assert len(orders.seen) == 2
    chain.fail_reveal = False
    events.clear()
    state = create().recover()
    assert events == ["reveal"] and len(orders.seen) == 2
    assert state["decisions"][0]["payload_utf8"] == pending["payload_utf8"]
    assert all(d["order_status"] in {"simulated", "hold"} for d in state["decisions"])


def test_market_error_is_redacted_and_next_cycle_survives(rig):
    _, client, chain, _, _, create = rig
    loop = create()
    client.fail_reads = True
    state = loop.run_once()
    assert "secret-provider-key" not in json.dumps(state)
    assert state["errors"] and chain.info()["commits"] == 0
    client.fail_reads = False
    assert loop.run_once()["chain"]["reveals"] == 1


@pytest.mark.parametrize("saved_version", ["0.5", "0.6"])
def test_restart_preserves_peak_cycle_counter_and_history(rig, saved_version):
    _, client, chain, _, _, create = rig
    previous = deepcopy(create().run_once())
    previous["contract_version"] = saved_version
    CycleStore(chain.root).save_state(previous)
    client.balance = lambda: [{"details": [{"ccy": "USDT", "cashBal": "70", "availBal": "70"}, {"ccy": "ETH", "cashBal": "0.2", "availBal": "0.2"}]}]
    state = create().run_once()
    assert state["contract_version"] == "0.6"
    assert state["agent"]["cycle_id"] == 2
    assert [row for row in state["decisions"] if row["cycle_id"] == 1] == previous["decisions"]
    assert state["portfolio"]["peak_equity_usdt"] == "100"
    assert any(error["code"] == "KILL_SWITCH" for error in state["errors"])
    assert chain.info()["reveals"] == 2


def test_invalid_config_stops_before_any_effect(rig):
    cfg, _, chain, _, events, create = rig
    cfg["cycle_seconds"] = 0
    with pytest.raises(GrailError, match="CONFIG"):
        create()
    assert events == [] and chain.info()["commits"] == 0


def test_simulated_chain_cannot_be_used_for_live_orders(rig):
    cfg, _, _, _, _, create = rig
    cfg["dry_run"] = False
    with pytest.raises(GrailError, match="SIMULATED"):
        create()


def test_real_engine_and_real_analyst_integrate_offline(rig):
    cfg, client, chain, _, _, _ = rig
    loop = AgentLoop(cfg, client, chain, chain.root, clock=lambda: 1792234800000)
    state = loop.run_once()
    assert len(state["decisions"]) == 3
    assert state["metrics"]["n_assets"] == 3
    assert all(d["llm_flag"] in {"skipped", "exempt"} for d in state["decisions"])
    assert chain.info()["reveals"] == 1


def test_recovery_queries_unknown_and_pending_live_ids_without_sending(rig):
    _, client, chain, _, _, create = rig
    chain.crash_after_commit = True
    with pytest.raises(SystemExit):
        create().run_once()
    store = CycleStore(chain.root)
    record = store.pending()[0]
    record["payload"]["dry_run"] = False
    for decision in record["payload"]["decisions"]:
        decision["dry_run"] = False
    from grail_agents.payload import canonical_payload
    record["payload_utf8"] = canonical_payload(record["payload"])
    record["commit_hash"] = commitment(record["payload_utf8"], record["salt_hex"])
    record["orders"] = {"BTC-USDT": {"order_status": "unknown", "okx_order_id": None}, "ETH-USDT": {"order_status": "pending", "okx_order_id": "42"}}
    chain.records["1"]["commit_hash"] = record["commit_hash"]
    store.save_pending(record)
    def status(inst, cid):
        client.queries.append((inst, cid))
        return {"order_status": "filled", "okx_order_id": "42", "fill_price": "100"}
    client.order_status = status
    state = create().recover()
    assert len(client.queries) == 2
    assert all(d["order_status"] == "filled" for d in state["decisions"] if d["action"] != "HOLD")


def test_corrupt_pending_is_reported_without_crashing_or_sending(rig):
    _, _, chain, orders, _, create = rig
    (chain.root / "pending").mkdir(exist_ok=True)
    (chain.root / "pending/1.json").write_text("corrupt")
    state = create().run_once()
    assert state["errors"] and orders.seen == []
    assert chain.info()["commits"] == 0


def test_two_cycles_are_scheduled_and_use_distinct_salts(rig):
    _, _, chain, _, _, create = rig
    class Scheduler:
        waits = []
        def is_set(self):
            return False
        def wait(self, seconds):
            self.waits.append(seconds)
    scheduler = Scheduler()
    state = create().run(cycles=2, stop_event=scheduler)
    assert state["agent"]["cycle_id"] == 2 and len(state["decisions"]) == 6
    assert len(scheduler.waits) == 1 and 0 < scheduler.waits[0] <= 90
    assert chain.lookup(1)["salt_hex"] != chain.lookup(2)["salt_hex"]
    assert state["agent"]["status"] == "stopped" and state["agent"]["next_cycle_at_ms"] is None


def test_real_process_exit_after_commit_recovers_with_fresh_adapters(rig):
    import subprocess
    import sys
    cfg, _, chain, _, _, _ = rig
    script = '''
import json, os, sys
from pathlib import Path
sys.path.insert(0, str(Path.cwd() / "tests"))
from test_loop import Market, fixed_decide
from grail_agents.loop import AgentLoop
from grail_agents.chain import SimulatedChain
cfg, root = json.loads(sys.argv[1]), Path(sys.argv[2])
class CrashChain(SimulatedChain):
    def commit(self, cycle_id, digest):
        super().commit(cycle_id, digest)
        os._exit(23)
chain = CrashChain(root / "fake-chain.json")
AgentLoop(cfg, Market(cfg["coins"]), chain, root, decide_fn=fixed_decide).run_once()
'''
    child = subprocess.run([sys.executable, "-c", script, json.dumps(cfg), str(chain.root)], capture_output=True, timeout=20)
    assert child.returncode == 23
    saved = CycleStore(chain.root).pending()[0]
    fresh_chain = SimulatedChain(chain.root / "fake-chain.json")
    recovered = AgentLoop(cfg, Market(cfg["coins"]), fresh_chain, chain.root).recover()
    assert fresh_chain.info()["commits"] == fresh_chain.info()["reveals"] == 1
    assert recovered["decisions"][0]["payload_utf8"] == saved["payload_utf8"]
    assert recovered["decisions"][0]["salt_hex"] == saved["salt_hex"]


def test_continuous_runner_keeps_lease_between_cycles(rig):
    _, _, _, _, _, create = rig
    class Scheduler:
        def is_set(self):
            return False
        def wait(self, seconds):
            with pytest.raises(GrailError, match="RUNTIME_LOCK"):
                create().run(cycles=1)
    assert create().run(cycles=2, stop_event=Scheduler())["agent"]["cycle_id"] == 2


def test_hold_only_cycle_commits_and_reveals_without_order(rig):
    cfg, client, chain, orders, events, _ = rig
    def all_hold(snapshot, portfolio, cfg):
        result = fixed_decide(snapshot, portfolio, cfg)
        for decision in result["payload"]["decisions"]:
            decision.update({"action": "HOLD", "size_usdt": "0"})
        return result
    state = AgentLoop(cfg, client, chain, chain.root, orders=orders, decide_fn=all_hold).run_once()
    assert events == ["commit", "reveal"] and orders.seen == []
    assert all(d["action"] == "HOLD" and d["order_status"] == "hold" for d in state["decisions"])
