"""Read-only account smoke and dry-run agent with explicit simulated/Fuji ledger."""
import argparse
import json
import os
from pathlib import Path

from dotenv import dotenv_values
from grail_analyst import make_provider

from .atk import AtkClient
from .chain import SimulatedChain, FujiChain
from .config import AgentConfig, GrailError, money, number
from .loop import AgentLoop
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


def load_provider():
    fields = ("LLM_API_KEY", "LLM_MODEL", "LLM_PROVIDER")
    settings = {key: os.environ[key] for key in fields if key in os.environ}
    path = os.environ.get("GRAIL_ENV")
    if path:
        if not Path(path).is_file():
            raise GrailError("GRAIL_ENV: configured environment file is missing")
        values = dotenv_values(path, interpolate=False)
        for key in fields:
            if key not in settings and values.get(key):
                settings[key] = values[key]
    return make_provider(settings)


def main(argv=None):
    parser = argparse.ArgumentParser(description="GRAIL read-only data + dry-run agent (no live orders)")
    parser.add_argument("command", choices=["smoke", "run"])
    parser.add_argument("--config", required=True, type=Path)
    parser.add_argument("--chain", choices=["simulated", "fuji"], help="explicit offline simulation or real Fuji transactions")
    parser.add_argument("--chain-file", type=Path, default=Path(__file__).resolve().parents[3] / 'contracts/chain.json')
    parser.add_argument("--runtime", type=Path, default=Path("runtime"))
    parser.add_argument("--cycles", type=int, help="positive cycle count; omit for continuous execution")
    args = parser.parse_args(argv)
    try:
        mapping = json.loads(args.config.read_text(encoding="utf-8"))
        if args.command == "smoke":
            result = run_smoke(mapping)
        else:
            cfg = AgentConfig.from_mapping(mapping)
            if not cfg.dry_run:
                raise GrailError("RUN_DRY_RUN: this command requires dry_run=true")
            if args.chain is None:
                raise GrailError("CHAIN_REQUIRED: explicitly choose --chain simulated or --chain fuji")
            if args.cycles is not None and args.cycles < 1:
                raise GrailError("CONFIG_CYCLES: cycles must be positive")
            chain = SimulatedChain(args.runtime / "simulated-chain.json") if args.chain == 'simulated' else FujiChain(args.chain_file, args.runtime)
            loop = AgentLoop(mapping, AtkClient(), chain, args.runtime, provider=load_provider())
            state = loop.run(cycles=args.cycles)
            result = {"ok": state["agent"]["status"] != "degraded", "chain_simulated": state['chain'].get('simulated', args.chain == 'simulated'), "state_path": str((args.runtime / "state.json").resolve()), "cycle_id": state["agent"]["cycle_id"], "errors": len(state["errors"]), "commits": state["chain"].get("commits"), "reveals": state["chain"].get("reveals")}
    except (OSError, json.JSONDecodeError):
        print(json.dumps({"ok": False, "error": "CONFIG_FILE: cannot read valid config JSON"}))
        return 1
    except GrailError as error:
        print(json.dumps({"ok": False, "error": str(error)}))
        return 1
    except KeyboardInterrupt:
        print(json.dumps({"ok": True, "stopped": True}))
        return 130
    print(json.dumps(result, ensure_ascii=True, indent=2))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
