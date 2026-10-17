"""180 günlük uzun backtest (salt okuma analiz): 5 strateji, aynı ücret modeli, örneklem dışı ayrımı, duyarlılık.

Kullanım (engine/ içinde):
  uv run python scripts/backtest_long.py --fetch   # OKX public history-candles (anahtarsız) → data/okx-candles-1H-180d.json
  uv run python scripts/backtest_long.py           # kayıtlı mumlarla (ağsız, deterministik) → out/backtest-180d.{json,md}
Stratejiler (src değişmez; farklar sadece bu betikte modül özniteliği değiştirilerek):
  buy_hold  eşit ağırlık al-tut
  base      T-012 öncesi temel motor: trend + HRP + vol hedefi, kapı yok (Hurst 0.6 sabit, setup "retest" sabit)
  t014      Hurst rejimi + kırılım/retest kapıları (MR kolu kapalı)
  t017      T-014 + O-U ortalamaya dönüş kolu (main'deki hali)
  t017_mr_exit_only_mr  T-017, ama MR çıkış/tutma kuralı sadece MR kolunun aldığı miktara uygulanır (R-012-1 varyantı);
            MR'la alınmamış pozisyonlar T-014 kuralıyla yönetilir. MR miktarı simülasyonda coin başına izlenir.
Simülasyon replay.py ile aynı: her kapanmış barda decide(), dolum bar kapanışında, ücret %0.1, başlangıç 50 USDT,
kill switch tepesi = simülasyondaki en yüksek equity. Look-ahead yok: decide sadece closes[t-lookback : t+1] görür.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import time
import urllib.request
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ENGINE = Path(__file__).resolve().parents[1]
CONFIG = ENGINE.parent / "contracts" / "config.example.json"
DATA = ENGINE / "data" / "okx-candles-1H-180d.json"
OUT = ENGINE / "out"
API = "https://www.okx.com/api/v5/market/history-candles"
DAYS, RECENT_DAYS = 180, 30
MAX_LB = 168
HPY = 8760
STRATS = ["buy_hold", "base", "t014", "t017", "t017_mr_exit_only_mr"]
LABEL = {"buy_hold": "(a) Buy and hold, equal weight", "base": "(b) Base engine, no gates (pre T-014)",
         "t014": "(c) T-014: Hurst + breakout/retest gates", "t017": "(d) T-017: T-014 + mean-reversion arm",
         "t017_mr_exit_only_mr": "(e) T-017, MR exit only on MR-bought amount"}


# ---------------------------------------------------------------- veri
def fetch(coins: list[str], bar: str, need: int) -> dict:
    """OKX public history-candles, eskiden yeniye [ts, o, h, l, c]; sadece kapanmış barlar (confirm=1). Doldurma yok."""
    out = {}
    for c in coins:
        got, after = {}, None
        while len(got) < need:
            url = f"{API}?instId={c}&bar={bar}&limit=100" + (f"&after={after}" if after is not None else "")
            req = urllib.request.Request(url, headers={"User-Agent": "grail-backtest"})
            r = json.load(urllib.request.urlopen(req, timeout=30))
            if r.get("code") != "0":
                raise SystemExit(f"OKX error for {c}: {r.get('msg')}")
            page = r["data"]
            if not page:
                break
            for row in page:
                if len(row) > 8 and str(row[8]) == "1":
                    got[int(row[0])] = [str(x) for x in row[:5]]
            oldest = min(int(row[0]) for row in page)
            if after is not None and oldest >= after:
                break
            after = oldest
            time.sleep(0.15)  # rate limit: 20 istek / 2 sn
        out[c] = [got[t] for t in sorted(got)][-need:]
    return out


def data_report(candles: dict, bar_ms: int) -> dict:
    rep = {}
    for c, rows in candles.items():
        ts = [int(r[0]) for r in rows]
        missing = sum((b - a) // bar_ms - 1 for a, b in zip(ts, ts[1:]) if b - a != bar_ms)
        bad = sum(1 for r in rows if not all(float(x) > 0 for x in r[1:5]))
        rep[c] = {"bars": len(rows), "first": _iso(ts[0]), "last": _iso(ts[-1]), "missing_bars": int(missing), "bad_rows": bad}
    return rep


def _iso(ms: int) -> str:
    return datetime.fromtimestamp(ms / 1000, timezone.utc).strftime("%Y-%m-%dT%H:%MZ")


class PeakTracker:
    """Analiz için kayan pencere zirvesi (son 168 saatin en yüksek equity'si). Motora girmedi (kullanıcı kararı:
    canlıda eski kural, tüm zamanlar zirvesi); sadece out/kill-switch-168.md ölçümü için burada."""

    def __init__(self, window_h: float = 168):
        from collections import deque
        self.window_ms, self.points = int(window_h * 3_600_000), deque()

    def update(self, t_ms: int, equity: float) -> float:
        self.points.append((int(t_ms), float(equity)))
        while self.points and self.points[0][0] <= t_ms - self.window_ms:
            self.points.popleft()
        return max(e for _, e in self.points)


# ---------------------------------------------------------------- simülasyon
def simulate(job: dict) -> dict:
    """Tek koşu (ayrı süreçte): job = {strategy, cfg_overrides, mod_overrides, n_bars}."""
    import grail_engine.decision as mod
    from grail_engine import decide
    from grail_engine.config import bar_minutes
    from grail_engine.replay import FEE_PCT, align_closes

    cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
    cfg.update(job.get("cfg", {}))
    candles = json.loads(DATA.read_text(encoding="utf-8"))["candles"]
    coins = sorted(cfg["coins"])
    ts, closes = align_closes({c: candles[c] for c in coins})
    lb, bar_ms = cfg["lookback_bars"], bar_minutes(cfg["candle_bar"]) * 60_000
    n_bars = job["n_bars"]
    start = len(ts) - n_bars
    assert start - lb >= 0, "not enough warmup bars"
    capital, fee, min_o = float(cfg["max_total_deploy_usdt"]), FEE_PCT / 100.0, float(cfg["min_order_usdt"])
    times = [ts[t] + bar_ms for t in range(start, len(ts))]  # bar kapanışı
    if job["strategy"] == "buy_hold":
        q = {c: capital / len(coins) * (1.0 - fee) / closes[c][start] for c in coins}
        eq = [sum(q[c] * closes[c][t] for c in coins) for t in range(start, len(ts))]
        return {"times": times, "equity": eq, "invested": eq, "trades": [len(coins)] + [0] * (n_bars - 1),
                "fees": [capital * fee] + [0.0] * (n_bars - 1), "mr_buys": 0, "capital": capital, "min_order": min_o,
                "kill": [False] * n_bars}

    s = job["strategy"]
    mods = dict(job.get("mod", {}))
    if s == "base":
        mods.update(hurst_dfa=lambda r: 0.6, breakout_setup=lambda c, tol: "retest")
    elif s == "t014":
        mods.update(_mr_target=lambda *a, **k: None)
    else:  # t017, t017_mr_exit_only_mr: MR kolu açık (decision.MR_ENABLED varsayılanı kapalı)
        mods.setdefault("MR_ENABLED", True)
    for k, v in mods.items():
        setattr(mod, k, v)

    cash, qty, peak = capital, {c: 0.0 for c in coins}, capital
    tracker = PeakTracker() if job.get("peak") == "rolling_168h" else None  # yoksa tüm zamanlar zirvesi (eski)
    mr_qty = {c: 0.0 for c in coins}
    px: dict[str, float] = {}
    by_last: dict[float, str] = {}
    if s == "t017_mr_exit_only_mr":
        orig = mod._mr_target

        def mr_only(inf, cur, mr_usdt):
            r = orig(inf, cur, mr_usdt)
            if r is None or r[0] > cur:  # giriş alımı aynen
                return r
            c = by_last.get(inf["last"])
            mv = mr_qty[c] * px[c] if c else 0.0
            if mv <= 0:
                return None  # MR'la alınmamış pozisyon: T-014 kuralı
            if r[0] == 0.0:
                return max(cur - mv, 0.0), r[1]  # sadece MR kısmını sat
            return r

        mod._mr_target = mr_only
    eq, inv, trades, fees, kill, mr_buys = [], [], [], [], [], 0
    for k, t in enumerate(range(start, len(ts))):
        px.clear()
        px.update({c: closes[c][t] for c in coins})
        by_last.clear()
        by_last.update({float(closes[c][t]): c for c in coins})
        e0 = cash + sum(qty[c] * px[c] for c in coins)
        peak = tracker.update(times[k], e0) if tracker else max(peak, e0)
        snap = {"cycle_id": k + 1, "at_ms": times[k], "closes": {c: closes[c][t - lb:t + 1] for c in coins}}
        port = {"equity_usdt": e0, "cash_usdt": cash, "peak_equity_usdt": peak,
                "positions": [{"inst_id": c, "size_base": qty[c], "value_usdt": qty[c] * px[c]} for c in coins if qty[c] > 0]}
        res = decide(snap, port, cfg)
        kill.append(bool((res["metrics"] or {}).get("kill_switch")))
        n_tr, f_bar = 0, 0.0
        frozen = job.get("kill_freeze") and kill[-1]  # eski davranış: tetikliyken hiç işlem yok (ayrıştırma için)
        for d in ([] if frozen else res["payload"]["decisions"]):
            c, size = d["inst_id"], float(d["size_usdt"])
            if d["action"] == "BUY":
                spend = min(size, cash)
                qn = spend * (1.0 - fee) / px[c]
                qty[c] += qn
                cash -= spend
                f_bar += spend * fee
                n_tr += 1
                if "mean-reversion buy" in d["reason"]:
                    mr_qty[c] += qn
                    mr_buys += 1
            elif d["action"] == "SELL":
                qs = min(size / px[c], qty[c])
                if "mean-reversion exit" in d["reason"]:
                    mr_qty[c] = max(0.0, mr_qty[c] - qs)
                elif qty[c] > 0:
                    mr_qty[c] *= 1.0 - qs / qty[c]
                cash += qs * px[c] * (1.0 - fee)
                f_bar += qs * px[c] * fee
                qty[c] -= qs
                n_tr += 1
        v = sum(qty[c] * px[c] for c in coins)
        eq.append(cash + v)
        inv.append(v)
        trades.append(n_tr)
        fees.append(f_bar)
    return {"times": times, "equity": eq, "invested": inv, "trades": trades, "fees": fees, "mr_buys": mr_buys,
            "capital": capital, "min_order": min_o, "kill": kill}


# ---------------------------------------------------------------- metrikler
def metrics(sim: dict, lo: int, hi: int) -> dict:
    """[lo, hi) bar dilimi; başlangıç değeri = önceki barın equity'si (lo=0 → sermaye)."""
    eq = np.array(sim["equity"][lo:hi])
    v0 = sim["capital"] if lo == 0 else sim["equity"][lo - 1]
    path = np.concatenate([[v0], eq])
    r = path[1:] / path[:-1] - 1.0
    n = r.size
    ret = path[-1] / v0 - 1.0
    sd = float(r.std(ddof=1))
    peak = np.maximum.accumulate(path)
    dd = float(((peak - path) / peak).max())
    ann = (1.0 + ret) ** (HPY / n) - 1.0
    inv = np.array(sim["invested"][lo:hi])
    return {"return_pct": round(ret * 100, 2), "ann_vol_pct": round(sd * math.sqrt(HPY) * 100, 2),
            "sharpe": round(float(r.mean()) / sd * math.sqrt(HPY), 2) if sd > 0 else None,
            "max_drawdown_pct": round(dd * 100, 2), "calmar": round(ann / dd, 2) if dd > 0 else None,
            "trades": int(sum(sim["trades"][lo:hi])), "fees_usdt": round(float(sum(sim["fees"][lo:hi])), 4),
            "time_in_market_pct": round(float(np.mean(inv >= sim["min_order"])) * 100, 1),
            "avg_invested_pct": round(float(np.mean(inv / eq)) * 100, 1),
            "kill_switch_bars_pct": round(float(np.mean(sim["kill"][lo:hi])) * 100, 1)}


def first_kill(sim: dict):
    return next((_iso(t) for t, k in zip(sim["times"], sim["kill"]) if k), None)


def monthly(sim: dict) -> dict:
    out, prev = {}, sim["capital"]
    months: dict[str, float] = {}
    for t, v in zip(sim["times"], sim["equity"]):
        months[datetime.fromtimestamp((t - 1) / 1000, timezone.utc).strftime("%Y-%m")] = v
    for mth, v in months.items():
        out[mth] = round((v / prev - 1.0) * 100, 2)
        prev = v
    return out


def daily(sim: dict) -> list:
    days: dict[str, float] = {}
    for t, v in zip(sim["times"], sim["equity"]):
        days[datetime.fromtimestamp((t - 1) / 1000, timezone.utc).strftime("%Y-%m-%d")] = round(v, 4)
    return [{"date": d, "usdt": v} for d, v in days.items()]


# ---------------------------------------------------------------- iş listesi
def jobs(n_bars: int) -> dict:
    j = {s: {"strategy": s, "n_bars": n_bars} for s in STRATS}
    for s in ("t014", "t017"):
        j[f"{s}|hurst-0.05"] = {"strategy": s, "n_bars": n_bars, "mod": {"HURST_RANGING": 0.40, "HURST_TRENDING": 0.50}}
        j[f"{s}|hurst+0.05"] = {"strategy": s, "n_bars": n_bars, "mod": {"HURST_RANGING": 0.50, "HURST_TRENDING": 0.60}}
    for s in ("base", "t014", "t017"):
        for lb in (96, 168):
            j[f"{s}|lookback{lb}"] = {"strategy": s, "n_bars": n_bars, "cfg": {"lookback_bars": lb}}
    for z in (-1.0, -2.0):
        j[f"t017|mr_z{z}"] = {"strategy": "t017", "n_bars": n_bars, "mod": {"MR_ENTRY_Z": z}}
    # bağlam (ayar değil): kill switch tepe equity'ye göre hiç sıfırlanmaz; kapalıyken strateji ne yapardı?
    for s in ("base", "t014", "t017"):
        j[f"{s}~kill_switch_off"] = {"strategy": s, "n_bars": n_bars, "cfg": {"kill_switch_drawdown_pct": 100}}
    return j


def run_all() -> dict:
    cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
    data = json.loads(DATA.read_text(encoding="utf-8"))
    bar_ms = 3_600_000
    n_bars = DAYS * 24
    js = jobs(n_bars)
    with ProcessPoolExecutor(max_workers=min(len(js), os.cpu_count() or 2)) as ex:
        sims = dict(zip(js, ex.map(simulate, js.values())))
    oos = n_bars - RECENT_DAYS * 24
    res = {"kind": "grail_backtest_180d", "source": data["source"], "fetched_at": _iso(data["fetched_at_ms"]),
           "data": data_report(data["candles"], bar_ms),
           "window": {"bars": n_bars, "start": _iso(sims["base"]["times"][0]), "end": _iso(sims["base"]["times"][-1]),
                      "out_of_sample": f"first {oos} bars (150 days)", "recent": f"last {RECENT_DAYS * 24} bars (30 days, seen in T-012)"},
           "assumptions": {"capital_usdt": 50, "fee_pct": 0.1, "config": {k: cfg[k] for k in (
               "lookback_bars", "target_vol_pct", "risk_budget_pct", "max_position_pct", "max_order_usdt", "min_order_usdt",
               "max_total_deploy_usdt", "kill_switch_drawdown_pct")}, "cash_return": 0},
           "strategies": {}, "sensitivity": {}}
    for s in STRATS:
        sim = sims[s]
        res["strategies"][s] = {"label": LABEL[s], "full_180d": metrics(sim, 0, n_bars),
                                "prior_150d_out_of_sample": metrics(sim, 0, oos), "last_30d": metrics(sim, oos, n_bars),
                                "mr_buys": sim["mr_buys"], "kill_switch_first": first_kill(sim),
                                "monthly_return_pct": monthly(sim), "daily_usdt": daily(sim)}
    res["kill_switch_off_context"] = {}
    for name, sim in sims.items():
        if "|" in name or "~" in name:
            m, m_oos = metrics(sim, 0, n_bars), metrics(sim, 0, oos)
            row = {k: m[k] for k in ("return_pct", "sharpe", "max_drawdown_pct", "trades", "kill_switch_bars_pct")} | {
                "oos_return_pct": m_oos["return_pct"], "oos_sharpe": m_oos["sharpe"]}
            (res["sensitivity"] if "|" in name else res["kill_switch_off_context"])[name] = row
    return res


# ---------------------------------------------------------------- rapor
def fmt(x, nd=2, sign=False):
    return "n/a" if x is None else (f"{x:+.{nd}f}" if sign else f"{x:.{nd}f}")


def sensitive(res: dict, s: str) -> dict:
    """Aşırı uyum uyarısı kuralı (önceden): bir varyant getirinin işaretini değiştirirse ya da Sharpe aralığı > 1.0 ise 'hassas'."""
    base = res["strategies"][s]["full_180d"]
    vs = [v for k, v in res["sensitivity"].items() if k.startswith(s + "|")]
    sh = [base["sharpe"]] + [v["sharpe"] for v in vs]
    rets = [base["return_pct"]] + [v["return_pct"] for v in vs]
    flip = any((r > 0) != (base["return_pct"] > 0) for r in rets)
    spread = max(sh) - min(sh)
    return {"sharpe_range": [min(sh), max(sh)], "return_range": [min(rets), max(rets)], "sign_flip": flip,
            "sensitive": bool(flip or spread > 1.0)}


def md(res: dict) -> str:
    S = res["strategies"]
    def table(seg):
        rows = ["| Strategy | Return | Ann. vol | Sharpe | Worst drop | Calmar | Trades | Fees (USDT) | In market | Avg invested | Safety stop on |",
                "|---|---|---|---|---|---|---|---|---|---|---|"]
        for s in STRATS:
            m = S[s][seg]
            rows.append(f"| {LABEL[s]} | {fmt(m['return_pct'], sign=True)}% | {fmt(m['ann_vol_pct'], 1)}% | {fmt(m['sharpe'], sign=True)} | "
                        f"{fmt(m['max_drawdown_pct'])}% | {fmt(m['calmar'], sign=True)} | {m['trades']} | {fmt(m['fees_usdt'])} | "
                        f"{fmt(m['time_in_market_pct'], 1)}% | {fmt(m['avg_invested_pct'], 1)}% | {fmt(m['kill_switch_bars_pct'], 1)}% of hours |")
        return rows
    krows = ["| Strategy | Safety stop | Return 180d | Sharpe | Worst drop | Trades | Stop on | Return OOS 150d | Sharpe OOS |",
             "|---|---|---|---|---|---|---|---|---|"]
    for s in ("base", "t014", "t017"):
        b, bo = S[s]["full_180d"], S[s]["prior_150d_out_of_sample"]
        krows.append(f"| {s} | 5% (config) | {b['return_pct']:+.2f}% | {fmt(b['sharpe'], sign=True)} | {b['max_drawdown_pct']:.2f}% | {b['trades']} | "
                     f"{b['kill_switch_bars_pct']:.1f}% | {bo['return_pct']:+.2f}% | {fmt(bo['sharpe'], sign=True)} |")
        k = res["kill_switch_off_context"][f"{s}~kill_switch_off"]
        krows.append(f"| {s} | off | {k['return_pct']:+.2f}% | {fmt(k['sharpe'], sign=True)} | {k['max_drawdown_pct']:.2f}% | {k['trades']} | "
                     f"{k['kill_switch_bars_pct']:.1f}% | {k['oos_return_pct']:+.2f}% | {fmt(k['oos_sharpe'], sign=True)} |")
    months = list(S["base"]["monthly_return_pct"])
    mrows = ["| Month | " + " | ".join(s for s in STRATS) + " |", "|---|" + "---|" * len(STRATS)]
    for mth in months:
        mrows.append(f"| {mth} | " + " | ".join(f"{S[s]['monthly_return_pct'][mth]:+.2f}%" for s in STRATS) + " |")
    srows = ["| Variant | Return 180d | Sharpe 180d | Worst drop | Trades | Return OOS 150d | Sharpe OOS |", "|---|---|---|---|---|---|---|"]
    for s in ("base", "t014", "t017"):
        b = S[s]["full_180d"]
        bo = S[s]["prior_150d_out_of_sample"]
        srows.append(f"| **{s} (default)** | {b['return_pct']:+.2f}% | {fmt(b['sharpe'], sign=True)} | {b['max_drawdown_pct']:.2f}% | {b['trades']} | "
                     f"{bo['return_pct']:+.2f}% | {fmt(bo['sharpe'], sign=True)} |")
        for k, v in res["sensitivity"].items():
            if k.startswith(s + "|"):
                srows.append(f"| {k} | {v['return_pct']:+.2f}% | {fmt(v['sharpe'], sign=True)} | {v['max_drawdown_pct']:.2f}% | {v['trades']} | "
                             f"{v['oos_return_pct']:+.2f}% | {fmt(v['oos_sharpe'], sign=True)} |")
    sens = {s: sensitive(res, s) for s in ("base", "t014", "t017")}
    o = {s: S[s]["prior_150d_out_of_sample"] for s in STRATS}
    f = {s: S[s]["full_180d"] for s in STRATS}
    G = STRATS[1:]
    all_neg = all(f[s]["return_pct"] < 0 for s in G) and all(o[s]["return_pct"] < 0 for s in G)
    t17_vs_14 = "daha iyi" if f["t017"]["return_pct"] > f["t014"]["return_pct"] else "daha kötü"
    sens_words = ", ".join(f"{s} {'HASSAS' if sens[s]['sensitive'] else 'kararlı'}" for s in sens)
    ko = res["kill_switch_off_context"]
    stop_helped = all(ko[f"{s}~kill_switch_off"]["return_pct"] < f[s]["return_pct"] for s in ("base", "t014", "t017"))
    dd_lo, dd_hi = min(f[s]["max_drawdown_pct"] for s in G), max(f[s]["max_drawdown_pct"] for s in G)
    sh_lo, sh_hi = min(o[s]["sharpe"] for s in G), max(o[s]["sharpe"] for s in G)
    best_sens = max((k for k in res["sensitivity"]), key=lambda k: res["sensitivity"][k]["return_pct"])
    d = res["data"]
    gaps = sum(v["missing_bars"] for v in d.values())
    lines = [
        "# GRAIL 180-day backtest: 5 strategies, same costs",
        "",
        f"Data: OKX public `history-candles` (no API key, read-only), 1H bars, fetched {res['fetched_at']}. "
        f"Test window {res['window']['start']} to {res['window']['end']} ({res['window']['bars']} hourly bars), plus up to {MAX_LB} bars "
        f"of warm-up before it. Missing bars across all coins: {gaps} (not filled; only timestamps present for all 5 coins are used). "
        "Same simulation and costs as `scripts/replay_okx.py`: one decision per closed bar, fills at the bar close, 0.1% fee, start 50 USDT, "
        "min/max order and total-deploy limits and kill switch from `contracts/config.example.json`. Cash earns 0. No look-ahead. "
        "Script: `engine/scripts/backtest_long.py` (run twice, identical output). Daily portfolio values for charts: `backtest-180d.json`.",
        "",
        f"**Özet (TR):** 180 günde {'GRAIL varyantlarının hepsi zarar etti' if all_neg else 'GRAIL varyantlarının sonucu karışık'} "
        f"(temel motor {f['base']['return_pct']:+.2f}%, T-014 {f['t014']['return_pct']:+.2f}%, T-017 {f['t017']['return_pct']:+.2f}%, "
        f"varyant (e) {f['t017_mr_exit_only_mr']['return_pct']:+.2f}%); al-tut {f['buy_hold']['return_pct']:+.2f}% kazandı ama "
        f"{f['buy_hold']['max_drawdown_pct']:.1f}% düşüş yaşadı, GRAIL'in en kötü düşüşü {dd_lo:.1f}–{dd_hi:.1f}% aralığında kaldı. "
        f"Örneklem dışı 150 günde Sharpe al-tut {fmt(o['buy_hold']['sharpe'], sign=True)}, GRAIL varyantları {sh_lo:+.2f} ile {sh_hi:+.2f} arası: "
        f"risk başına getiride de al-tutun gerisindeyiz. Kapılar (T-014) düşüşü {f['base']['max_drawdown_pct']:.1f}% → "
        f"{f['t014']['max_drawdown_pct']:.1f}% indirdi ama getiriyi pozitife çevirmedi; T-017'nin O-U kolu T-014'ten {t17_vs_14}; "
        f"%5 güvenlik durdurmasının açık olduğu saat oranı T-017'de %{f['t017']['kill_switch_bars_pct']:.0f}"
        f"{' ve kapatılınca üç motor da daha çok kaybediyor' if stop_helped else ''}. "
        f"Duyarlılık: {sens_words} (örn. {best_sens} {res['sensitivity'][best_sens]['return_pct']:+.2f}%); bu bir aşırı uyum uyarısıdır, "
        "parametreleri buna göre DEĞİŞTİRMEDİK.",
        "",
        "## Full 180 days",
        "",
        *table("full_180d"),
        "",
        "## Prior 150 days (out of sample: never looked at while building the engine)",
        "",
        *table("prior_150d_out_of_sample"),
        "",
        "## Last 30 days (already seen in T-012, so not out of sample)",
        "",
        *table("last_30d"),
        "",
        f"Mean-reversion buys over 180 days: T-017 {S['t017']['mr_buys']}, variant (e) {S['t017_mr_exit_only_mr']['mr_buys']}.",
        "",
        "## Month by month",
        "",
        "Month boundaries are UTC. The first and last months are partial.",
        "",
        *mrows,
        "",
        "## Sensitivity (no tuning, report only)",
        "",
        "Hurst thresholds ±0.05 (ranging/trending cut-offs 0.40/0.50 and 0.50/0.60), lookback 96 and 168 bars, mean-reversion entry z −1.0 and −2.0. "
        "Rule fixed before running: a strategy is called **sensitive** if any variant flips the sign of its 180-day return or its Sharpe range "
        "across variants is wider than 1.0.",
        "",
        *srows,
        "",
        *[f"- {s}: Sharpe range {sens[s]['sharpe_range'][0]:+.2f} to {sens[s]['sharpe_range'][1]:+.2f}, return range "
          f"{sens[s]['return_range'][0]:+.2f}% to {sens[s]['return_range'][1]:+.2f}% → "
          f"**{'SENSITIVE: overfitting warning, do not trust the default numbers alone' if sens[s]['sensitive'] else 'stable across these variants'}**"
          for s in sens],
        "",
        "## Safety stop (kill switch) context",
        "",
        "The config stops all trading while the account is 5% or more below its highest value so far, and it does not sell: "
        "positions stay frozen until the account recovers. Over 180 days this rule decides a lot. The 'off' rows show what the same "
        "strategy would have done with the stop disabled. This is context only, not a tuned setting: the live config keeps the 5% stop.",
        "",
        *[f"- {s}: first safety stop at {S[s]['kill_switch_first'] or 'never'}." for s in STRATS[1:]],
        "",
        *krows,
        "",
        "## Data check",
        "",
        "| Coin | Bars | First | Last | Missing bars | Bad rows |",
        "|---|---|---|---|---|---|",
        *[f"| {c} | {v['bars']} | {v['first']} | {v['last']} | {v['missing_bars']} | {v['bad_rows']} |" for c, v in d.items()],
        "",
        "## Honest reading",
        f"- {'Every GRAIL variant lost money over 180 days and over the 150 out-of-sample days.' if all_neg else 'GRAIL results are mixed.'} "
        f"Buy-and-hold made {f['buy_hold']['return_pct']:+.2f}% but fell {f['buy_hold']['max_drawdown_pct']:.1f}% on the way; "
        f"GRAIL's worst drop stayed between {dd_lo:.1f}% and {dd_hi:.1f}%. On risk-adjusted terms (Sharpe), GRAIL is still behind buy-and-hold.",
        "- The entry gates (T-014) cut the worst drop of the base engine by more than half, but did not make it profitable. "
        f"The mean-reversion arm (T-017) is {'worse' if t17_vs_14 == 'daha kötü' else 'better'} than T-014 over 180 days.",
        f"- The 5% safety stop was on for a large share of hours. {'Turning it off makes all three engines lose more, so the stop helped.' if stop_helped else ''}",
        "- All three engines are sensitive to their thresholds (some variants flip to a gain). Picking the best variant after the fact "
        "would be overfitting, so the defaults stay unchanged.",
        "- The last 30 days continue from the state at day 150, so they differ slightly from the T-012 replay, which started flat.",
        "- One 180-day period of 5 highly correlated coins is still a small sample. Sharpe over 150 days has a standard error of about ±1.5.",
        "- The GRAIL variants hold mostly cash (see 'Avg invested'), so they should be compared with buy-and-hold on risk "
        "(worst drop, volatility, Sharpe), not on raw return.",
        "- Variant (e) needs the backtest to remember which coins were bought by the mean-reversion arm. The live engine is stateless and "
        "cannot do this yet, so (e) is a what-if, not a ready feature.",
        "",
    ]
    return "\n".join(lines)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fetch", action="store_true")
    a = ap.parse_args()
    if a.fetch:
        cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
        need = DAYS * 24 + MAX_LB + 24
        candles = fetch(sorted(cfg["coins"]), cfg["candle_bar"], need)
        DATA.parent.mkdir(parents=True, exist_ok=True)
        body = {"source": "OKX public REST /api/v5/market/history-candles (no key, read-only)", "bar": cfg["candle_bar"],
                "fetched_at_ms": int(time.time() * 1000), "candles": candles}
        DATA.write_text(json.dumps(body, separators=(",", ":")) + "\n", encoding="utf-8")
        print({c: len(v) for c, v in candles.items()})
    res = run_all()
    OUT.mkdir(exist_ok=True)
    (OUT / "backtest-180d.json").write_text(json.dumps(res, indent=1, ensure_ascii=True, allow_nan=False) + "\n", encoding="utf-8")
    (OUT / "backtest-180d.md").write_text(md(res), encoding="utf-8")
    for s in STRATS:
        print(s, res["strategies"][s]["full_180d"], "| OOS", res["strategies"][s]["prior_150d_out_of_sample"])


if __name__ == "__main__":
    main()
