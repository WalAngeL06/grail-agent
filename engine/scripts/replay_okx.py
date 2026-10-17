"""T-012: OKX ATK'dan (salt okunur `okx market candles`) son 30 günün mumlarını çek, GRAIL'i geriye oynat.

Kullanım (engine/ içinde):
  uv run python scripts/replay_okx.py --fetch   # mumları ATK'dan çek → data/okx-candles-<bar>.json, sonra oynat
  uv run python scripts/replay_okx.py           # kayıtlı mumlarla oynat (ağsız, deterministik)
Çıktı: out/replay.json, out/replay-summary.md. Emir/tx YOK: çalışan tek dış komut `okx market candles`.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import time
from pathlib import Path

from grail_engine.config import bar_minutes
from grail_engine.replay import DAYS, FEE_PCT, replay, summary_text

ENGINE = Path(__file__).resolve().parents[1]
CONFIG = ENGINE.parent / "contracts" / "config.example.json"
PAGE = 300  # OKX market candles tek çağrıda en fazla 300 satır döner
SOURCE = "OKX Agent Trade Kit: okx market candles (read-only market data)"


def okx_runner(profile: str | None):
    """`okx --json [--profile p] <args>` çalıştırıp JSON döndüren fonksiyon."""
    exe = shutil.which("okx")
    if not exe:
        raise SystemExit("okx CLI (OKX Agent Trade Kit) not found on PATH")

    def run(args: list[str]):
        cmd = [exe, "--json", *(["--profile", profile] if profile else []), *args]
        proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=60)
        if proc.returncode != 0:
            raise SystemExit(f"okx failed ({proc.returncode}): {proc.stderr.strip()[:300]}")
        return json.loads(proc.stdout)

    return run


def fetch_candles(inst: str, bar: str, need: int, run) -> list[list[str]]:
    """En yeni `need` kapanmış bar, eskiden yeniye [ts, o, h, l, c]. Sadece `market candles`; --after ile geriye sayfalar."""
    got: dict[int, list[str]] = {}
    after = None
    while len(got) < need:
        page = run(["market", "candles", inst, "--bar", bar, "--limit", str(PAGE),
                    *(["--after", str(after)] if after is not None else [])])
        if not page:
            break
        for r in page:
            if len(r) < 9 or str(r[8]) == "1":  # açık (confirm=0) bar alınmaz
                got[int(r[0])] = [str(x) for x in r[:5]]
        oldest = min(int(r[0]) for r in page)
        if after is not None and oldest >= after:
            break
        after = oldest
    return [got[t] for t in sorted(got)][-need:]


def fetch_all(cfg: dict, days: int, run) -> dict:
    need = days * 1440 // bar_minutes(cfg["candle_bar"]) + cfg["lookback_bars"]
    candles = {c: fetch_candles(c, cfg["candle_bar"], need, run) for c in sorted(cfg["coins"])}
    return {"source": SOURCE, "bar": cfg["candle_bar"], "fetched_at_ms": int(time.time() * 1000), "candles": candles}


def _dump(head: dict, key: str, lines: list[str], brackets: str) -> str:
    """Okunur JSON: üst alanlar girintili, son `key` alanının öğeleri satır başına bir tane."""
    body = json.dumps(head, indent=2, ensure_ascii=True, allow_nan=False)[:-2]
    items = ",\n".join(f"    {ln}" for ln in lines)
    return f'{body},\n  "{key}": {brackets[0]}\n{items}\n  {brackets[1]}\n}}\n'


def _compact(x) -> str:
    return json.dumps(x, separators=(",", ":"), allow_nan=False)


def write_data(data: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [f"{json.dumps(c)}: {_compact(r)}" for c, r in data["candles"].items()]
    path.write_text(_dump({k: v for k, v in data.items() if k != "candles"}, "candles", lines, "{}"), encoding="utf-8")


def run_replay(data_path: Path, out_dir: Path, cfg: dict, **kw) -> dict:
    data = json.loads(Path(data_path).read_text(encoding="utf-8"))
    res = replay(data["candles"], cfg, **kw)
    res = {"source": {"source": data.get("source"), "bar": data.get("bar"), "fetched_at_ms": data.get("fetched_at_ms"),
                      "file": Path(data_path).name}, **res}
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    head = {k: v for k, v in res.items() if k != "series"}
    (out_dir / "replay.json").write_text(_dump(head, "series", [_compact(p) for p in res["series"]], "[]"), encoding="utf-8")
    (out_dir / "replay-summary.md").write_text(summary_text(res), encoding="utf-8")
    return res


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description="Replay GRAIL engine decisions on recent OKX candles (no orders, no tx).")
    ap.add_argument("--fetch", action="store_true", help="refresh candles via `okx market candles` before replaying")
    ap.add_argument("--days", type=int, default=DAYS)
    ap.add_argument("--profile", default="grail", help="ATK profile (market data needs no keys)")
    ap.add_argument("--fee-pct", type=float, default=FEE_PCT)
    ap.add_argument("--capital", type=float, default=None, help="start capital in USDT (default: max_total_deploy_usdt)")
    ap.add_argument("--config", type=Path, default=CONFIG)
    a = ap.parse_args(argv)
    cfg = json.loads(a.config.read_text(encoding="utf-8"))
    data_path = ENGINE / "data" / f"okx-candles-{cfg['candle_bar']}.json"
    if a.fetch:
        write_data(fetch_all(cfg, a.days, okx_runner(a.profile)), data_path)
    window = a.days * 1440 // bar_minutes(cfg["candle_bar"])
    res = run_replay(data_path, ENGINE / "out", cfg, capital_usdt=a.capital, fee_pct=a.fee_pct, window_bars=window)
    print(summary_text(res))
    print(json.dumps({"window": res["window"], "grail": res["grail"], "buy_hold": res["buy_hold"]}, indent=2))


if __name__ == "__main__":
    main()
