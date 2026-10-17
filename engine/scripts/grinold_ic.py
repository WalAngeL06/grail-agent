"""Grinold Temel Yasası ölçümü (salt okuma, analiz): 30 günlük replay, T-014 (MR kapalı) vs T-017 (MR açık).

Kullanım (engine/ içinde): uv run python scripts/grinold_ic.py → out/grinold-30d.json + out/grinold-30d.md
Kaynak: data/okx-candles-1H.json (T-012), config: contracts/config.example.json. Emir/tx/ağ yok.
T-014 = aynı kod, sadece MR kolu bu betikte kapatılır (decision._mr_target → None); src değişmez.
Tahmin (birincil) = motorun o saatteki kararı: BUY +1 / HOLD 0 / SELL −1 (zincire commit edilen şey).
Gerçekleşen = ileri getiri close[t+h]/close[t]−1, h ∈ {1, 6, 24} saat (sadece ölçüm için ileri bakılır).
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from scipy import stats as st

import grail_engine.decision as mod
from grail_engine import decide
from grail_engine.config import bar_minutes
from grail_engine.replay import DAYS, FEE_PCT, align_closes, max_drawdown_pct

ENGINE = Path(__file__).resolve().parents[1]
CONFIG = ENGINE.parent / "contracts" / "config.example.json"
DATA = ENGINE / "data" / "okx-candles-1H.json"
OUT = ENGINE / "out"
HORIZONS = [1, 6, 24]
HEADLINE_H = 24  # önceden seçildi: sinyal 48 barlık trend, 24 saatlik ufuk doğal ölçek
SCORE = {"BUY": 1.0, "HOLD": 0.0, "SELL": -1.0}
HOURS_PER_YEAR = 8760


def run(cfg: dict, candles: dict, mr_on: bool) -> dict:
    """replay() ile aynı simülasyon; ek olarak her bar/coin için karar skoru, hedef ağırlık, n_eff ve equity."""
    orig = mod._mr_target
    if not mr_on:
        mod._mr_target = lambda *a, **k: None
    try:
        coins = sorted(cfg["coins"])
        ts, closes = align_closes({c: candles[c] for c in coins})
        lb, bar_min = cfg["lookback_bars"], bar_minutes(cfg["candle_bar"])
        n_bars = min(DAYS * 1440 // bar_min, len(ts) - lb)
        start = len(ts) - n_bars
        capital, fee = float(cfg["max_total_deploy_usdt"]), FEE_PCT / 100.0
        cash, qty, peak = capital, {c: 0.0 for c in coins}, capital
        rows, equity, trades = [], [], 0
        for k, t in enumerate(range(start, len(ts))):
            px = {c: closes[c][t] for c in coins}
            eq0 = cash + sum(qty[c] * px[c] for c in coins)
            peak = max(peak, eq0)
            snap = {"cycle_id": k + 1, "at_ms": ts[t] + bar_min * 60_000, "closes": {c: closes[c][t - lb:t + 1] for c in coins}}
            port = {"equity_usdt": eq0, "cash_usdt": cash, "peak_equity_usdt": peak,
                    "positions": [{"inst_id": c, "size_base": qty[c], "value_usdt": qty[c] * px[c]} for c in coins if qty[c] > 0]}
            res = decide(snap, port, cfg)
            dec = {d["inst_id"]: d for d in res["payload"]["decisions"]}
            for c in coins:
                d, size = dec[c], float(dec[c]["size_usdt"])
                if d["action"] == "BUY":
                    spend = min(size, cash)
                    qty[c] += spend * (1.0 - fee) / px[c]
                    cash -= spend
                    trades += 1
                elif d["action"] == "SELL":
                    q = min(size / px[c], qty[c])
                    cash += q * px[c] * (1.0 - fee)
                    qty[c] -= q
                    trades += 1
            rows.append({"t": t, "score": [SCORE[dec[c]["action"]] for c in coins],
                         "tw": [float(dec[c]["target_weight_pct"]) for c in coins], "n_eff": (res["metrics"] or {}).get("n_eff")})
            equity.append(cash + sum(qty[c] * px[c] for c in coins))
        return {"coins": coins, "closes": closes, "rows": rows, "equity": equity, "capital": capital, "trades": trades,
                "n_ts": len(ts)}
    finally:
        mod._mr_target = orig


def newey_west_t(x: np.ndarray, lags: int) -> float:
    """Ortalamanın Newey-West (Bartlett) t istatistiği."""
    x = np.asarray(x, dtype=float)
    n = x.size
    if n < 3:
        return math.nan
    e = x - x.mean()
    var = float(e @ e) / n
    for lag in range(1, lags + 1):
        var += 2.0 * (1.0 - lag / (lags + 1)) * float(e[lag:] @ e[:-lag]) / n
    return float(x.mean() / math.sqrt(var / n)) if var > 0 else math.nan


def spearman(a, b):
    a, b = np.asarray(a, float), np.asarray(b, float)
    if a.size < 3 or np.unique(a).size < 2 or np.unique(b).size < 2:
        return math.nan, math.nan
    r = st.spearmanr(a, b)
    return float(r.statistic), float(r.pvalue)


def ic_stats(sim: dict, key: str, h: int, diff: bool = False) -> dict:
    coins, closes, rows = sim["coins"], sim["closes"], sim["rows"]
    F, R, per_t_ic, nonover_F, nonover_R = [], [], [], [], []
    for j, row in enumerate(rows):
        t = row["t"]
        if t + h >= sim["n_ts"]:
            continue
        f = np.array(row[key], float)
        if diff:
            f = f - (np.array(rows[j - 1][key], float) if j > 0 else 0.0)
        r = np.array([closes[c][t + h] / closes[c][t] - 1.0 for c in coins])
        F.extend(f.tolist())
        R.extend(r.tolist())
        if j % h == 0:
            nonover_F.extend(f.tolist())
            nonover_R.extend(r.tolist())
        ic_t, _ = spearman(f, r)
        if math.isfinite(ic_t):
            per_t_ic.append(ic_t)
    ic, _ = spearman(F, R)
    ic_no, p_no = spearman(nonover_F, nonover_R)
    ts_ic = np.array(per_t_ic)
    return {"ic_pooled": round(ic, 4), "n_pairs": len(F),
            "ic_pooled_nonoverlap": round(ic_no, 4), "p_nonoverlap": round(p_no, 4), "n_pairs_nonoverlap": len(nonover_F),
            "ic_cross_section_mean": round(float(ts_ic.mean()), 4) if ts_ic.size else None,
            "nw_t": round(newey_west_t(ts_ic, max(h - 1, 0)), 2) if ts_ic.size > 2 else None,
            "hours_with_defined_ic": int(ts_ic.size)}


def analyze(sim: dict) -> dict:
    eq = np.array([sim["capital"]] + sim["equity"])
    r = eq[1:] / eq[:-1] - 1.0
    ir_real = float(r.mean() / r.std(ddof=1) * math.sqrt(HOURS_PER_YEAR)) if r.std(ddof=1) > 0 else math.nan
    neffs = [x["n_eff"] for x in sim["rows"] if x["n_eff"] is not None]
    n_eff = float(np.mean(neffs))
    out = {"replay": {"return_pct": round((eq[-1] / sim["capital"] - 1) * 100, 2), "max_drawdown_pct": round(max_drawdown_pct(eq[1:]), 2),
                      "trades": sim["trades"]},
           "n_eff_mean": round(n_eff, 3), "realized_ir_annual": round(ir_real, 3),
           # yıllık Sharpe'ın standart hatası ≈ √((1 + SR_bar²/2) / N) × √(yıllık bar): 30 günde ~±3.5
           "realized_ir_se_annual": round(math.sqrt((1 + 0.5 * (r.mean() / r.std(ddof=1)) ** 2) / r.size * HOURS_PER_YEAR), 2),
           "horizons": {}}
    for h in HORIZONS:
        prim = ic_stats(sim, "score", h)
        br = n_eff * HOURS_PER_YEAR / h
        ir_g = prim["ic_pooled"] * math.sqrt(br)
        sig = bool(prim["p_nonoverlap"] < 0.05 and prim["nw_t"] is not None and abs(prim["nw_t"]) >= 2.0)
        out["horizons"][str(h)] = {
            "action_score": prim,
            "target_weight_level": {k: v for k, v in ic_stats(sim, "tw", h).items() if k in ("ic_pooled", "ic_pooled_nonoverlap", "p_nonoverlap")},
            "target_weight_change": {k: v for k, v in ic_stats(sim, "tw", h, diff=True).items() if k in ("ic_pooled", "ic_pooled_nonoverlap", "p_nonoverlap")},
            "breadth_annual": round(br, 1), "grinold_ir": round(ir_g, 3),
            # IC anlamsızken realized/Grinold oranı (transfer katsayısı) anlamsız → null
            "implied_transfer_coefficient": round(ir_real / ir_g, 3) if sig and ir_g and math.isfinite(ir_real) else None,
            "significant": sig,
        }
    return out


def md(res: dict) -> str:
    h = str(HEADLINE_H)
    a, b = res["engines"]["t014_momentum_only"], res["engines"]["t017_with_mean_reversion"]
    def row(name, e, hh):
        x = e["horizons"][hh]
        s = x["action_score"]
        return (f"| {name} | {hh}h | {s['ic_pooled']:+.4f} | {s['ic_pooled_nonoverlap']:+.4f} (p={s['p_nonoverlap']:.3f}) | "
                f"{s['ic_cross_section_mean'] if s['ic_cross_section_mean'] is None else format(s['ic_cross_section_mean'], '+.4f')} "
                f"(NW t={s['nw_t']}) | {x['breadth_annual']:,.0f} | {x['grinold_ir']:+.2f} | {e['realized_ir_annual']:+.2f} | "
                f"{'yes' if x['significant'] else 'no'} |")
    def word(e):
        return "anlamlı" if e["horizons"][h]["significant"] else "anlamsız"
    ha, hb = a["horizons"][h], b["horizons"][h]
    lines = [
        "# Grinold's Fundamental Law, measured on the 30-day replay",
        "",
        f"Source: `engine/data/okx-candles-1H.json` (real OKX hourly prices, {res['window']}), config `contracts/config.example.json`, "
        "same simulation as `scripts/replay_okx.py`. Script: `engine/scripts/grinold_ic.py` (deterministic; run twice, identical output). "
        "T-014 = momentum + entry gates (mean-reversion arm switched off inside the script only); T-017 = with the mean-reversion arm.",
        "",
        f"**Özet (TR):** T-014 için {h} saatlik ufukta IC = {ha['action_score']['ic_pooled']:+.4f}, genişlik = {a['n_eff_mean']:.2f} bağımsız bahis "
        f"(yıllık ≈ {ha['breadth_annual']:,.0f}), Grinold IR ≈ {ha['grinold_ir']:+.2f}, gerçekleşen IR = {a['realized_ir_annual']:+.2f}; "
        f"bu 30 günde tahmin isabeti {word(a)}. "
        f"T-017 için aynı ufukta IC = {hb['action_score']['ic_pooled']:+.4f}, Grinold IR ≈ {hb['grinold_ir']:+.2f}, gerçekleşen IR = "
        f"{b['realized_ir_annual']:+.2f} ({word(b)}). "
        "30 gün ve 5 yüksek korelasyonlu coin çok kısa bir örnek: genişlik (n_eff) ölçtüğümüz ve yönettiğimiz şey, isabet (IC) iddiamız yok.",
        "",
        "## Definitions",
        "- **Forecast** (primary): the engine's committed decision for each hour and coin, BUY = +1, HOLD = 0, SELL = −1. "
        "Also reported: target weight level and its hourly change.",
        "- **Realized**: forward return `close[t+h] / close[t] − 1`, h = 1, 6, 24 hours. Looking forward is used only for scoring; "
        "the engine never sees it.",
        "- **IC**: Spearman rank correlation, pooled over all (hour, coin) pairs. Significance: (a) the pooled IC on a non-overlapping "
        "subsample (every h-th hour) with its p-value; (b) the mean of the per-hour cross-sectional IC (5 coins) with a Newey-West t "
        "(lag h−1). Hours where all 5 forecasts are equal (e.g. all HOLD) have no cross-sectional IC and are skipped. "
        "\"Significant\" = p < 0.05 AND |NW t| ≥ 2.",
        "- **Breadth**: mean n_eff (independent bets per hour, from the engine) × 8760 / h per year.",
        "- **Grinold IR** ≈ IC × √breadth. **Realized IR** = annualized mean / sd of hourly strategy returns (cash earns 0).",
        f"- Headline horizon {HEADLINE_H}h was chosen before looking at results (the signal is a 48-hour trend).",
        "",
        "## Results (forecast = BUY/HOLD/SELL score)",
        "",
        "| Engine | Horizon | IC pooled | IC non-overlap | Mean cross-section IC | Breadth / yr | Grinold IR | Realized IR | Significant |",
        "|---|---|---|---|---|---|---|---|---|",
        *[row("T-014", a, str(x)) for x in HORIZONS],
        *[row("T-017", b, str(x)) for x in HORIZONS],
        "",
        f"Replay check: T-014 {a['replay']['return_pct']:+.2f}%, worst drop {a['replay']['max_drawdown_pct']:.2f}%, {a['replay']['trades']} trades; "
        f"T-017 {b['replay']['return_pct']:+.2f}%, worst drop {b['replay']['max_drawdown_pct']:.2f}%, {b['replay']['trades']} trades "
        "(same as the official replays). Mean n_eff: "
        f"T-014 {a['n_eff_mean']:.2f}, T-017 {b['n_eff_mean']:.2f} out of 5 coins.",
        "",
        "Other forecast definitions (pooled IC, non-overlap p):",
        "",
        "| Engine | Horizon | Target weight level | Target weight change |",
        "|---|---|---|---|",
        *[f"| {n} | {x}h | {e['horizons'][str(x)]['target_weight_level']['ic_pooled']:+.4f} (p={e['horizons'][str(x)]['target_weight_level']['p_nonoverlap']:.3f}) | "
          f"{e['horizons'][str(x)]['target_weight_change']['ic_pooled']:+.4f} (p={e['horizons'][str(x)]['target_weight_change']['p_nonoverlap']:.3f}) |"
          for n, e in (("T-014", a), ("T-017", b)) for x in HORIZONS],
        "",
        "## Honest reading",
        "- 30 days is short: at 24h there are only ~29 non-overlapping days × 5 coins. One month of mostly rising prices.",
        "- The 5 coins move together (mean n_eff ≈ "
        f"{a['n_eff_mean']:.1f} of 5), so the 5 forecasts per hour are not 5 independent bets. That is exactly what n_eff measures.",
        "- The breadth formula assumes a fresh independent forecast every h hours. Our trend signal changes slowly, so true breadth is "
        "lower and Grinold IR is an upper bound.",
        f"- Realized IR over 30 days has a standard error of about ±{a['realized_ir_se_annual']:.1f} (annualized), so "
        f"{a['realized_ir_annual']:+.2f} (T-014) and {b['realized_ir_annual']:+.2f} (T-017) are not statistically different from zero either. "
        "With IC ≈ 0, the gap between Grinold IR and realized IR is noise plus being mostly in cash in a rising month, not skill. "
        "The implied transfer coefficient (realized / Grinold IR) is left empty (null) when IC is not significant.",
        "- Conclusion: we do not claim forecasting skill (IC) from this sample. What GRAIL measures and manages is breadth: "
        "it counts how many independent bets the coins really are (n_eff) and sizes as one group when they move together.",
        "",
    ]
    return "\n".join(lines)


def main() -> None:
    cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
    data = json.loads(DATA.read_text(encoding="utf-8"))
    engines = {"t014_momentum_only": analyze(run(cfg, data["candles"], mr_on=False)),
               "t017_with_mean_reversion": analyze(run(cfg, data["candles"], mr_on=True))}
    res = {"kind": "grinold_fundamental_law", "source": "data/okx-candles-1H.json + contracts/config.example.json",
           "window": "last 30 days of the T-012 candle file, 1H bars", "forecast": "BUY +1 / HOLD 0 / SELL -1",
           "horizons_h": HORIZONS, "headline_h": HEADLINE_H, "engines": engines}
    OUT.mkdir(exist_ok=True)
    (OUT / "grinold-30d.json").write_text(json.dumps(res, indent=2, ensure_ascii=True, allow_nan=False) + "\n", encoding="utf-8")
    (OUT / "grinold-30d.md").write_text(md(res), encoding="utf-8")
    print(json.dumps({k: {kk: vv for kk, vv in v.items() if kk != "horizons"} | {"h24": v["horizons"]["24"]} for k, v in engines.items()}, indent=1))


if __name__ == "__main__":
    main()
