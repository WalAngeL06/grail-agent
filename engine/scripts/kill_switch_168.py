"""Kill switch zirvesi: tüm zamanlar vs kayan 168 saat (salt okuma analiz), lookback 168, T-014 ve T-017.

Kullanım (engine/ içinde): uv run python scripts/kill_switch_168.py → out/kill-switch-168.json (tablo stdout'a)
Motor: tetikliyken yeni BUY yok, SELL serbest (yeni davranış). "all_time" satırları ayrıştırma içindir:
aynı motor, sadece zirve tüm zamanlar. Eski davranış (zirve tüm zamanlar + pozisyon dondurma) out/lookback-168.md'de.
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
JOBS = {f"{s}|{pk}|{mode}": {"strategy": s, "n_bars": N, "cfg": {"lookback_bars": 168}, "peak": pk,
                              "kill_freeze": mode == "freeze"}
        for s in ("t014", "t017") for pk in ("rolling_168h", "all_time") for mode in ("sell_ok", "freeze")}


def main() -> None:
    with ProcessPoolExecutor(max_workers=min(len(JOBS), os.cpu_count() or 2)) as ex:
        sims = dict(zip(JOBS, ex.map(bl.simulate, JOBS.values())))
    keys = ("return_pct", "sharpe", "max_drawdown_pct", "trades", "kill_switch_bars_pct")
    res = {name: {seg: {k: bl.metrics(sim, lo, hi)[k] for k in keys}
                  for seg, (lo, hi) in {"full_180d": (0, N), "prior_150d_oos": (0, OOS)}.items()} for name, sim in sims.items()}
    (bl.OUT / "kill-switch-168.json").write_text(json.dumps(res, indent=1, ensure_ascii=True) + "\n", encoding="utf-8")
    print("| Engine | Peak | While stop on | Period | Return | Sharpe | Worst drop | Trades | Safety stop on |")
    print("|---|---|---|---|---|---|---|---|---|")
    for name, r in res.items():
        s, pk, mode = name.split("|")
        for seg, lab in (("full_180d", "180 days"), ("prior_150d_oos", "prior 150 days (OOS)")):
            m = r[seg]
            print(f"| {s.upper()} | {pk} | {mode} | {lab} | {m['return_pct']:+.2f}% | {m['sharpe']:+.2f} | {m['max_drawdown_pct']:.2f}% | "
                  f"{m['trades']} | {m['kill_switch_bars_pct']:.1f}% |")


if __name__ == "__main__":
    main()
