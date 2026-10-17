"""Recoverable synchronous agent cycle. External effects are behind injected adapters."""
from copy import deepcopy
import json
import secrets
from threading import Event
import time

from grail_analyst import review_payload
from grail_engine import decide, validate_config

from .config import AgentConfig, GrailError
from .journal import OrderJournal
from .market import fetch_snapshot
from .orders import OrderService
from .payload import canonical_payload, client_order_id, commitment
from .storage import CycleStore


class AgentLoop:
    def __init__(self, config, client, chain, runtime, *, provider=None, news_source=None, clock=None, decide_fn=None, orders=None, live_confirmed=False):
        if validate_config(config):
            raise GrailError("CONFIG_INVALID: engine config validation failed")
        self.cfg = AgentConfig.from_mapping(config)
        if config.get("contract_version") != "0.6":
            raise GrailError("CONFIG_VERSION: expected contracts 0.6")
        if not self.cfg.dry_run and chain.info().get("simulated"):
            raise GrailError("SIMULATED_CHAIN_LIVE: simulated chain cannot authorize real orders")
        if not self.cfg.dry_run and live_confirmed is not True:
            raise GrailError("LIVE_CONFIRMATION: user activation is required")
        self.config = deepcopy(config)
        self.client, self.chain = client, chain
        self.store = CycleStore(runtime)
        self.provider, self.news_source = provider, news_source
        self.clock = clock or (lambda: time.time_ns() // 1_000_000)
        self.decide = decide_fn or decide
        self.orders, self.live_confirmed = orders, live_confirmed
        self.state = self.store.load_state() or {
            "contract_version": "0.6", "generated_at_ms": self.clock(), "mode": "live", "dry_run": self.cfg.dry_run,
            "agent": {"name": config["agent_name"], "status": "starting", "cycle_id": 0, "next_cycle_at_ms": None},
            "market": [], "portfolio": {"equity_usdt": "0", "cash_usdt": "0", "positions": []},
            "metrics": {}, "decisions": [], "errors": [], "chain": {},
        }
        fields = ("coins", "risk_budget_pct", "max_position_pct", "cycle_seconds", "max_order_usdt", "max_total_deploy_usdt", "kill_switch_drawdown_pct")
        self.state.update({"contract_version": "0.6", "mode": "live", "dry_run": self.cfg.dry_run, "config": {key: deepcopy(config[key]) for key in fields}})

    def _error(self, error, where, cycle_id=0):
        if isinstance(error, GrailError):
            message = str(error)
            code = message.split(":", 1)[0]
        else:
            code, message = "AGENT_ERROR", f"Unexpected {type(error).__name__} in {where}"
        self.state["errors"].append({"code": code, "message": message, "at_ms": self.clock(), "where": where, "context": {"cycle_id": cycle_id}})
        self.state["errors"] = self.state["errors"][-100:]

    def _save_state(self):
        self.state["generated_at_ms"] = self.clock()
        try:
            self.state["chain"] = self.chain.info()
        except Exception as error:
            self._error(error, "agents.chain.info", self.state["agent"]["cycle_id"])
        self.store.save_state(self.state)

    def _check_record(self, record):
        payload = record["payload"]
        if payload["cycle_id"] != record["cycle_id"] or canonical_payload(payload) != record["payload_utf8"] or commitment(record["payload_utf8"], record["salt_hex"]) != record["commit_hash"]:
            raise GrailError("PENDING_INTEGRITY: recorded payload/salt/hash mismatch")

    def _publish(self, record):
        # Only revealed bytes and salt become public state. Pending files stay private.
        rows = []
        for decision in record["payload"]["decisions"]:
            result = record["orders"].get(decision["inst_id"], {"order_status": "unknown", "okx_order_id": None, "fill_price": None})
            outcome = {key: result.get(key) for key in ("order_status", "okx_order_id", "fill_price")}
            for key in ("client_order_id", "rejection_code"):
                if key in result:
                    outcome[key] = result[key]
            for key in ("size_usdt", "size_base"):
                if key in result:
                    outcome["execution_" + key] = result[key]
            rows.append({**decision, **outcome, "commit_tx": record.get("commit_tx"), "commit_hash": record["commit_hash"], "reveal_tx": record["reveal_tx"], "payload_utf8": record["payload_utf8"], "salt_hex": record["salt_hex"], "verified": not self.chain.info().get("simulated", False)})
        previous = [row for row in self.state["decisions"] if row["cycle_id"] != record["cycle_id"]]
        self.state["decisions"] = (previous + rows)[-500:]
        self.state["agent"]["cycle_id"] = max(self.state["agent"]["cycle_id"], record["cycle_id"])
        self._save_state()
        self.store.remove_pending(record["cycle_id"])

    @staticmethod
    def _order_summary(record):
        values = {}
        for decision in record["payload"]["decisions"]:
            result = record["orders"].get(decision["inst_id"], {})
            status = result.get("order_status", "unknown")
            if decision["action"] == "HOLD" or status in {"hold", "blocked", "rejected"}:
                continue
            values[decision["inst_id"]] = "simulated" if status == "simulated" else str(result.get("okx_order_id") or "unknown")
        return json.dumps(values, sort_keys=True, separators=(",", ":")) if values else ""

    def _reveal(self, record):
        # Every retry first checks confirmation, including a reveal mined before a crash.
        entry = self.chain.lookup(record["cycle_id"])
        if not entry or entry["commit_hash"] != record["commit_hash"]:
            raise GrailError("CHAIN_COMMIT_UNCONFIRMED: do not reveal or execute")
        record["commit_tx"] = entry.get("commit_tx") or record.get("commit_tx")
        if entry["revealed"]:
            record["reveal_tx"] = entry.get("reveal_tx") or record.get("reveal_tx")
        else:
            record["reveal_tx"] = self.chain.reveal(record["cycle_id"], record["payload_utf8"], record["salt_hex"], self._order_summary(record))
        if not record["reveal_tx"]:
            raise GrailError("CHAIN_REVEAL_UNCONFIRMED: receipt required")
        record["phase"] = "revealed"
        self.store.save_pending(record)
        self._publish(record)

    def _recover_pending(self):
        try:
            records = self.store.pending()
        except Exception as error:
            self._error(error, "agents.recovery.storage")
            return False
        for record in records:
            try:
                self._check_record(record)
                entry = self.chain.lookup(record["cycle_id"])
                if not entry:
                    raise GrailError("CHAIN_COMMIT_UNCONFIRMED: pending cycle retained, never recommitted")
                if entry["commit_hash"] != record["commit_hash"]:
                    raise GrailError("CHAIN_COMMIT_MISMATCH: pending cycle retained")
                for decision in record["payload"]["decisions"]:
                    inst = decision["inst_id"]
                    existing = record["orders"].get(inst)
                    if existing and (record["payload"]["dry_run"] or existing.get("order_status") in {"hold", "filled", "canceled", "rejected", "blocked"}):
                        continue
                    result = {"okx_order_id": None, "fill_price": None, **(existing or {}), "order_status": "hold" if decision["action"] == "HOLD" else "unknown"}
                    if decision["action"] != "HOLD" and not record["payload"]["dry_run"]:
                        try:
                            result = self.client.order_status(inst, record["client_order_ids"][inst])
                        except Exception as error:
                            self._error(error, "agents.recovery.order", record["cycle_id"])
                    record["orders"][inst] = result
                self.store.save_pending(record)
                self._reveal(record)
            except Exception as error:
                self._error(error, "agents.recovery", record.get("cycle_id", 0))
        return True

    def recover(self):
        with self.store.lock():
            self._recover_pending()
            self._save_state()
            return deepcopy(self.state)

    def run_once(self):
        with self.store.lock():
            if not self._recover_pending():
                self.state["agent"]["status"] = "degraded"
                self._save_state()
                return deepcopy(self.state)
            cycle_id = self.state["agent"]["cycle_id"]
            try:
                cycle_id = self.store.allocate_cycle(minimum=self.chain.next_cycle_id())
                self.state["agent"].update({"status": "running", "cycle_id": cycle_id})
                data = fetch_snapshot(self.client, self.cfg)
                portfolio = data["portfolio"]
                portfolio["peak_equity_usdt"] = self.store.update_peak(portfolio["equity_usdt"])
                self.state.update({"market": data["market"], "portfolio": portfolio})
                snapshot = {"cycle_id": cycle_id, "at_ms": self.clock(), "candles": data["candles"], "last": {row["inst_id"]: row["last"] for row in data["market"]}}
                result = self.decide(snapshot, portfolio, self.config)
                self.state["metrics"] = result["metrics"]
                for error in result.get("errors", []):
                    self.state["errors"].append(error)
                self.state["errors"] = self.state["errors"][-100:]
                news = []
                if self.news_source:
                    try:
                        news = self.news_source()
                    except Exception as error:
                        self._error(error, "agents.news", cycle_id)
                payload = review_payload(result["payload"], snapshot, news, self.config, self.provider)
                if not isinstance(payload, dict) or payload.get("cycle_id") != cycle_id or payload.get("dry_run") is not self.cfg.dry_run or sorted(d["inst_id"] for d in payload["decisions"]) != sorted(self.cfg.coins):
                    raise GrailError("PAYLOAD_INVALID: final payload does not match this cycle/config")
                text = canonical_payload(payload)
                salt = "0x" + secrets.token_bytes(32).hex()
                record = {"cycle_id": cycle_id, "payload": json.loads(text), "payload_utf8": text, "salt_hex": salt, "commit_hash": commitment(text, salt), "commit_tx": None, "reveal_tx": None, "phase": "prepared", "orders": {}, "client_order_ids": {d["inst_id"]: client_order_id(payload["agent"], cycle_id, d["inst_id"]) for d in payload["decisions"]}}
                self.store.save_pending(record)
                record["commit_tx"] = self.chain.commit(cycle_id, record["commit_hash"])
                if not record["commit_tx"]:
                    raise GrailError("CHAIN_COMMIT_UNCONFIRMED: no confirmed receipt; no orders")
                record["phase"] = "committed"
                self.store.save_pending(record)
                orders = self.orders
                if orders is None:
                    orders = OrderService(self.client, self.cfg, data["instruments"], journal=OrderJournal(self.store.root / "orders.sqlite3") if not self.cfg.dry_run else None)
                    # Simulated reservations cover this batch only; the real
                    # portfolio is refreshed, unchanged by simulation, next cycle.
                    if not self.cfg.dry_run:
                        self.orders = orders
                for decision in record["payload"]["decisions"]:
                    inst = decision["inst_id"]
                    outcome = {"okx_order_id": None, "order_status": "hold", "fill_price": None}
                    if decision["action"] != "HOLD":
                        try:
                            outcome = orders.execute(deepcopy(decision), portfolio, client_order_id=record["client_order_ids"][inst], live_confirmed=self.live_confirmed)
                            if outcome["order_status"] in {"simulated", "filled", "canceled", "pending", "partial", "unknown"}:
                                try:
                                    outcome = orders.query(record["client_order_ids"][inst])
                                except Exception as error:
                                    self._error(error, "agents.order.query", cycle_id)
                                    outcome = {**outcome, "order_status": "unknown"}
                        except Exception as error:
                            self._error(error, "agents.order", cycle_id)
                            outcome = {"okx_order_id": None, "order_status": "blocked" if isinstance(error, GrailError) else "unknown", "fill_price": None}
                    record["orders"][inst] = outcome
                    self.store.save_pending(record)
                self._reveal(record)
            except Exception as error:
                self._error(error, "agents.cycle", cycle_id)
                self.state["agent"]["status"] = "degraded"
            self.state["agent"]["next_cycle_at_ms"] = self.clock() + int(self.config["cycle_seconds"] * 1000)
            self._save_state()
            return deepcopy(self.state)

    def run(self, *, cycles=None, stop_event=None):
        if cycles is not None and (type(cycles) is not int or cycles < 1):
            raise GrailError("CONFIG_CYCLES: cycles must be positive or None")
        stop_event = stop_event or Event()
        with self.store.lock("runner.lock"):
            completed = 0
            try:
                while not stop_event.is_set() and (cycles is None or completed < cycles):
                    started = time.monotonic()
                    self.run_once()
                    completed += 1
                    if cycles is None or completed < cycles:
                        stop_event.wait(max(0, self.config["cycle_seconds"] - (time.monotonic() - started)))
            finally:
                with self.store.lock():
                    if self.state["agent"]["status"] != "degraded":
                        self.state["agent"]["status"] = "stopped"
                    self.state["agent"]["next_cycle_at_ms"] = None
                    self._save_state()
            return deepcopy(self.state)
