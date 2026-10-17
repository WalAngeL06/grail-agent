"""Lookback 48 vs 168 (salt okuma analiz): T-014 (MR kapalı) ve T-017 (MR açık), 180 gün / örneklem dışı 150 gün / son 30 gün.

Kullanım (engine/ içinde): uv run python scripts/lookback_168.py → out/lookback-168.json (tablo stdout'a)
Simülasyon ve veri backtest_long.py ile aynı (data/okx-candles-1H-180d.json).
"""
from __future__ import annotations

import json
import os
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import backtest_long as bl  # noqa: E402

N = bl.DAYS * 24
OOS = N - bl.RECENT_DAYS * 24
JOBS = {f"{s}|lb{lb}": {"strategy": s, "n_bars": N, "cfg": {"lookback_bars": lb}} for s in ("t014", "t017") for lb in (48, 168)}


def main() -> None:
    with ProcessPoolExecutor(max_workers=min(len(JOBS), os.cpu_count() or 2)) as ex:
        sims = dict(zip(JOBS, ex.map(bl.simulate, JOBS.values())))
    keys = ("return_pct", "sharpe", "max_drawdown_pct", "trades", "kill_switch_bars_pct")
    res = {name: {seg: {k: bl.metrics(sim, lo, hi)[k] for k in keys}
                  for seg, (lo, hi) in {"full_180d": (0, N), "prior_150d_oos": (0, OOS), "last_30d": (OOS, N)}.items()}
           | {"mr_buys": sim["mr_buys"]} for name, sim in sims.items()}
    out = bl.OUT / "lookback-168.json"
    out.write_text(json.dumps(res, indent=1, ensure_ascii=True) + "\n", encoding="utf-8")
    print("| Engine | Lookback | Period | Return | Sharpe | Worst drop | Trades | Safety stop on |")
    print("|---|---|---|---|---|---|---|---|")
    for name, r in res.items():
        s, lb = name.split("|")
        for seg, lab in (("full_180d", "180 days"), ("prior_150d_oos", "prior 150 days (OOS)"), ("last_30d", "last 30 days")):
            m = r[seg]
            print(f"| {s.upper()} | {lb[2:]} | {lab} | {m['return_pct']:+.2f}% | {m['sharpe']:+.2f} | {m['max_drawdown_pct']:.2f}% | "
                  f"{m['trades']} | {m['kill_switch_bars_pct']:.1f}% |")
    print({n: r["mr_buys"] for n, r in res.items()})


if __name__ == "__main__":
    main()
