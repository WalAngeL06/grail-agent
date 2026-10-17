"""replay(): GRAIL kararlarını geçmiş mumlarla geriye oynat, eşit ağırlıklı al-tut ile karşılaştır (T-012).

Saf (ağ/dosya/saat yok), deterministik. Emir/tx yok: her kapanmış barda decide() çağrılır,
BUY/SELL o barın kapanışında ücretle simüle edilir. Kill switch için tepe equity = simülasyondaki en yüksek equity.
"""
from __future__ import annotations

import math
from datetime import datetime, timezone

from .config import bar_minutes, validate_config
from .decision import decide
from .peak import PeakTracker

DAYS = 30
FEE_PCT = 0.1  # OKX spot taker varsayımı (%)
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
BAR_WORDS = {"1H": "hourly", "1D": "daily", "1Dutc": "daily"}
CFG_KEYS = ["candle_bar", "lookback_bars", "target_vol_pct", "risk_budget_pct", "max_position_pct",
            "max_order_usdt", "min_order_usdt", "max_total_deploy_usdt", "kill_switch_drawdown_pct"]


def _utc(ms: int) -> datetime:
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc)


def _iso(ms: int) -> str:
    return _utc(ms).strftime("%Y-%m-%dT%H:%MZ")


def _day(ms: int) -> str:
    d = _utc(ms)
    return f"{MONTHS[d.month - 1]} {d.day}, {d.year}"


def align_closes(candles: dict) -> tuple[list[int], dict[str, list[float]]]:
    """OKX ham satırları → bütün coinlerde ortak, kapanmış (confirm=1) barların artan zamanlı kapanışları."""
    by_inst = {}
    for inst, rs in candles.items():
        by_inst[inst] = {int(r[0]): float(r[4]) for r in rs or [] if len(r) < 9 or str(r[8]) == "1"}
    common = sorted(set.intersection(*(set(d) for d in by_inst.values()))) if by_inst else []
    return common, {inst: [d[t] for t in common] for inst, d in by_inst.items()}


def max_drawdown_pct(values) -> float:
    """En kötü tepe → dip düşüşü (%, pozitif)."""
    peak, worst = -math.inf, 0.0
    for v in values:
        peak = max(peak, v)
        if peak > 0:
            worst = max(worst, (1.0 - v / peak) * 100.0)
    return worst


def count_cash_moves(invested, threshold: float) -> int:
    """Yatırımdan (>= threshold) nakde (< threshold) geçiş sayısı."""
    moves, was_in = 0, False
    for v in invested:
        now_in = v >= threshold
        moves += was_in and not now_in
        was_in = now_in
    return moves


def replay(candles: dict, cfg: dict, *, capital_usdt=None, fee_pct: float = FEE_PCT, window_bars: int | None = None) -> dict:
    """candles: {instId: OKX ham satırları}. Son `window_bars` (varsayılan 30 gün) kapanmış bar oynatılır;
    öncesindeki `lookback_bars` bar ısınma penceresidir. Başlangıç sermayesi varsayılan max_total_deploy_usdt.
    Yetersiz veri / geçersiz config → ValueError."""
    errs = validate_config(cfg)
    if errs:
        raise ValueError(f"invalid config: {errs}")
    coins = sorted(cfg["coins"])
    missing = [c for c in coins if not candles.get(c)]
    if missing:
        raise ValueError(f"no candles for {missing}")
    ts, closes = align_closes({c: candles[c] for c in coins})
    lb, bar_min = cfg["lookback_bars"], bar_minutes(cfg["candle_bar"])
    bar_ms = bar_min * 60_000
    n_bars = min(window_bars or DAYS * 1440 // bar_min, len(ts) - lb)
    if n_bars < 1:
        raise ValueError(f"not enough bars: {len(ts)} common closed bars, need more than lookback {lb}")
    start = len(ts) - n_bars
    capital = float(capital_usdt if capital_usdt is not None else cfg["max_total_deploy_usdt"])
    fee, min_o = fee_pct / 100.0, float(cfg["min_order_usdt"])

    bh_qty = {c: capital / len(coins) * (1.0 - fee) / closes[c][start] for c in coins}
    cash, qty = capital, {c: 0.0 for c in coins}
    tracker = PeakTracker()  # kill switch zirvesi: son KILL_SWITCH_WINDOW_H saatin en yüksek equity'si (agents ile aynı)
    series, invested, held = [], [], {c: [] for c in coins}
    orders = {"buy": 0, "sell": 0, "hold": 0, "largest_usdt": 0.0}
    fees = 0.0
    kill_bars = engine_errors = 0
    for k, t in enumerate(range(start, len(ts))):
        px = {c: closes[c][t] for c in coins}
        at_ms = ts[t] + bar_ms  # bar kapanışı
        equity = cash + sum(qty[c] * px[c] for c in coins)
        peak = tracker.update(at_ms, equity)
        snap = {"cycle_id": k + 1, "at_ms": at_ms, "closes": {c: closes[c][t - lb:t + 1] for c in coins}}
        port = {"equity_usdt": equity, "cash_usdt": cash, "peak_equity_usdt": peak,
                "positions": [{"inst_id": c, "size_base": qty[c], "value_usdt": qty[c] * px[c]} for c in coins if qty[c] > 0]}
        res = decide(snap, port, cfg)
        engine_errors += not res["ok"]
        m = res["metrics"] or {}
        kill_bars += bool(m.get("kill_switch"))
        for d in (res["payload"] or {}).get("decisions", []):
            c, size = d["inst_id"], float(d["size_usdt"])
            orders[d["action"].lower()] += 1
            if d["action"] == "BUY":
                spend = min(size, cash)
                qty[c] += spend * (1.0 - fee) / px[c]
                cash -= spend
                fees += spend * fee
            elif d["action"] == "SELL":
                q = min(size / px[c], qty[c])
                cash += q * px[c] * (1.0 - fee)
                fees += q * px[c] * fee
                qty[c] -= q
            if d["action"] != "HOLD":
                orders["largest_usdt"] = max(orders["largest_usdt"], size)
        vals = {c: qty[c] * px[c] for c in coins}
        inv = sum(vals.values())
        eq = cash + inv
        invested.append(inv)
        for c in coins:
            held[c].append(vals[c])
        series.append({
            "t_ms": at_ms, "time": _iso(at_ms), "grail_usdt": round(eq, 4),
            "buy_hold_usdt": round(sum(bh_qty[c] * px[c] for c in coins), 4),
            "grail_cash_pct": round(cash / eq * 100.0, 2) if eq > 0 else 100.0,
            "independent_bets": m.get("n_eff"),
        })

    bets = [p["independent_bets"] for p in series if p["independent_bets"] is not None]
    g_vals, b_vals = [p["grail_usdt"] for p in series], [p["buy_hold_usdt"] for p in series]

    def perf(vals):
        return {"start_usdt": capital, "final_usdt": float(vals[-1]),
                "return_pct": round((vals[-1] / capital - 1.0) * 100.0, 2), "max_drawdown_pct": round(max_drawdown_pct(vals), 2)}

    orders["largest_usdt"] = round(orders["largest_usdt"], 2)
    return {
        "kind": "grail_replay", "contract_version": cfg.get("contract_version"), "agent": cfg["agent_name"], "coins": coins,
        "window": {"bar": cfg["candle_bar"], "bars": n_bars, "warmup_bars": lb, "days": round(n_bars * bar_min / 1440, 1),
                   "start_ms": series[0]["t_ms"], "end_ms": series[-1]["t_ms"], "start": series[0]["time"], "end": series[-1]["time"]},
        "assumptions": {
            "capital_usdt": capital, "fee_pct": fee_pct, "fills": "simulated at each bar close, no slippage",
            "cycle": "one engine decision per closed bar", "peak_equity": "highest simulated equity in the last 168 hours (kill switch)",
            "orders_sent": 0, "chain_tx_sent": 0, "config": {k: cfg[k] for k in CFG_KEYS},
        },
        "grail": {
            **perf(g_vals),
            "avg_independent_bets": round(sum(bets) / len(bets), 2) if bets else None,
            "times_went_to_cash": count_cash_moves(invested, min_o),
            "coin_exits": sum(count_cash_moves(held[c], min_o) for c in coins),
            "bars_fully_in_cash_pct": round(100.0 * sum(v < min_o for v in invested) / n_bars, 1),
            "orders": orders, "fees_usdt": round(fees, 4), "kill_switch_bars": kill_bars, "engine_errors": engine_errors,
        },
        "buy_hold": perf(b_vals),
        "series": series,
    }


def summary_text(res: dict) -> str:
    """replay() sonucunun sade İngilizce, 3 cümlelik özeti (Markdown)."""
    g, b, w = res["grail"], res["buy_hold"], res["window"]
    src = str((res.get("source") or {}).get("source", "")).lower()
    bars = BAR_WORDS.get(w["bar"], w["bar"])
    prices = f"real OKX {bars} prices" if "okx" in src else f"past {bars} prices"
    n = len(res["coins"])
    s1 = (f"In a {w['days']:g}-day simulation on {prices} ({_day(w['start_ms'])} to {_day(w['end_ms'])}) with no real orders sent, "
          f"GRAIL turned {g['start_usdt']:.2f} USDT into {g['final_usdt']:.2f} USDT ({g['return_pct']:+.1f}%), "
          f"while buying and holding all {n} coins equally ended at {b['final_usdt']:.2f} USDT ({b['return_pct']:+.1f}%).")
    k = g["times_went_to_cash"]
    cash = ("it never moved fully to cash" if k == 0 else
            f"it moved fully to cash {'once' if k == 1 else f'{k} times'} when prices turned down")
    s2 = f"Its worst drop from a high point was {g['max_drawdown_pct']:.1f}% versus {b['max_drawdown_pct']:.1f}% for buy-and-hold, and {cash}"
    if g["kill_switch_bars"]:
        limit = res["assumptions"]["config"]["kill_switch_drawdown_pct"]
        s2 += f"; the safety stop ({limit:g}% loss limit) paused trading for {100.0 * g['kill_switch_bars'] / w['bars']:.0f}% of the time"
    s2 += "."
    if g["avg_independent_bets"] is None:
        s3 = f"GRAIL could not measure how closely the {n} coins move together in this window."
    else:
        s3 = (f"On average the {n} coins behaved like only {g['avg_independent_bets']:.1f} independent bets because they tend to move "
              f"together, so GRAIL sizes them as one group instead of treating each coin as a separate bet.")
    return f"# GRAIL {w['days']:g}-day replay\n\n{s1} {s2} {s3}\n"
