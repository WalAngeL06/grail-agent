"""Read-only live-account smoke. There is deliberately no live-trading CLI."""
import argparse
import json
from pathlib import Path

from .atk import AtkClient
from .config import AgentConfig, GrailError, money, number
from .market import fetch_snapshot
from .orders import OrderService


def run_smoke(mapping, client=None):
    cfg = AgentConfig.from_mapping(mapping)
    if not cfg.dry_run:
        raise GrailError("SMOKE_DRY_RUN: smoke requires dry_run=true")
    client = client if client is not None else AtkClient()
    snapshot = fetch_snapshot(client, cfg)
    inst = cfg.coins[0]
    prices = {row["inst_id"]: row["last"] for row in snapshot["market"]}
    decision = {"inst_id": inst, "action": "BUY", "size_usdt": money(cfg.min_order_usdt), "ref_price": prices[inst], "mode": "live", "dry_run": True}
    order = OrderService(client, cfg, snapshot["instruments"]).execute(decision, snapshot["portfolio"], client_order_id="grailSmoke")
    instruments = {key: {field: rule[field] for field in ("minSz", "lotSz", "tickSz")} | {"min_order_usdt_at_last": money(number(rule["minSz"], "minimum") * number(prices[key], "price"))} for key, rule in snapshot["instruments"].items()}
    return {"ok": True, "contract_version": mapping.get("contract_version"), "mode": "live", "dry_run": True, "market": snapshot["market"], "portfolio": snapshot["portfolio"], "instruments": instruments, "candle_counts": {key: len(rows) for key, rows in snapshot["candles"].items()}, "order": order}


def main(argv=None):
    parser = argparse.ArgumentParser(description="GRAIL ATK data + simulated-order smoke (never places a live order)")
    parser.add_argument("command", choices=["smoke"])
    parser.add_argument("--config", required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        mapping = json.loads(args.config.read_text(encoding="utf-8"))
        result = run_smoke(mapping)
    except (OSError, json.JSONDecodeError):
        print(json.dumps({"ok": False, "error": "CONFIG_FILE: cannot read valid config JSON"}))
        return 1
    except GrailError as error:
        print(json.dumps({"ok": False, "error": str(error)}))
        return 1
    print(json.dumps(result, ensure_ascii=True, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
