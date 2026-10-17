"""Read-only smoke and default dry-run agent, with explicit live spot activation."""
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

LIVE_CONFIRM_PHRASE = "GRAIL-LIVE-SPOT"


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
    parser = argparse.ArgumentParser(description="GRAIL agent: dry-run by default; live spot requires explicit config and confirmation")
    parser.add_argument("command", choices=["smoke", "run"])
    parser.add_argument("--config", required=True, type=Path)
    parser.add_argument("--chain", choices=["simulated", "fuji"], help="explicit offline simulation or real Fuji transactions")
    parser.add_argument("--chain-file", type=Path, default=Path(__file__).resolve().parents[3] / 'contracts/chain.json')
    parser.add_argument("--runtime", type=Path, default=Path("runtime"))
    parser.add_argument("--cycles", type=int, help="positive cycle count; recommend 1 for first live run; omit for continuous execution")
    parser.add_argument("--live", action="store_true", help="enable live spot only with dry_run=false, --chain fuji and --confirm-live")
    parser.add_argument("--confirm-live", metavar="PHRASE", help=f"explicit live confirmation: {LIVE_CONFIRM_PHRASE}")
    args = parser.parse_args(argv)
    try:
        mapping = json.loads(args.config.read_text(encoding="utf-8"))
        if args.command == "smoke":
            if args.live or args.confirm_live is not None:
                raise GrailError("LIVE_FLAGS: smoke does not accept live activation")
            result = run_smoke(mapping)
        else:
            cfg = AgentConfig.from_mapping(mapping)
            if args.live or args.confirm_live is not None or not cfg.dry_run:
                if cfg.dry_run:
                    raise GrailError("LIVE_CONFIG: live activation requires dry_run=false in config")
                if not args.live or args.confirm_live != LIVE_CONFIRM_PHRASE:
                    raise GrailError(f"LIVE_CONFIRMATION: require --live --confirm-live {LIVE_CONFIRM_PHRASE}")
                if args.chain != "fuji":
                    raise GrailError("LIVE_CHAIN: live activation requires --chain fuji")
            if args.chain is None:
                raise GrailError("CHAIN_REQUIRED: explicitly choose --chain simulated or --chain fuji")
            if args.cycles is not None and args.cycles < 1:
                raise GrailError("CONFIG_CYCLES: cycles must be positive")
            chain = SimulatedChain(args.runtime / "simulated-chain.json") if args.chain == 'simulated' else FujiChain(args.chain_file, args.runtime)
            loop = AgentLoop(mapping, AtkClient(), chain, args.runtime, provider=load_provider(), live_confirmed=args.live)
            state = loop.run(cycles=args.cycles)
            result = {"ok": state["agent"]["status"] != "degraded", "dry_run": cfg.dry_run, "chain_simulated": state['chain'].get('simulated', args.chain == 'simulated'), "state_path": str((args.runtime / "state.json").resolve()), "cycle_id": state["agent"]["cycle_id"], "errors": len(state["errors"]), "commits": state["chain"].get("commits"), "reveals": state["chain"].get("reveals")}
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
