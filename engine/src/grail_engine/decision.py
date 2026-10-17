"""decide(): coin başına BUY/SELL/HOLD (contracts/decision.md). Saf, deterministik, istisna fırlatmaz.

Yön sinyali = hedef ağırlığa yeniden dengeleme (T-001 §6):
trend filtresi → trendi pozitif coinlerde HRP → vol hedefi → pozisyon/risk tavanları → hedef USDT − mevcut.
"""
from __future__ import annotations

import math
from decimal import ROUND_DOWN, Decimal

import numpy as np

from .config import bar_minutes, to_decimal, validate_config
from .hrp import hrp_weights
from .stats import avg_corr, breakout_setup, corr_matrix, hurst_dfa, n_eff, ou_fit, psr, sr_portfolio

SR_SINGLE = 0.5  # Holy Grail metriği için varsayılan tekil SR (sadece gösterim)
# T-014 kapıları (config'te değil, sabit). 48 bar kısa → Hurst gürültülü, bu yüzden arada ölü bant.
HURST_RANGING = 0.45  # altı: ortalamaya dönen piyasa → momentum alımı yok
HURST_TRENDING = 0.55  # üstü: trend; arası "unclear" (engel yok)
RETEST_TOL_MIN = 0.002  # retest bandı: seviyenin ±max(%0.2, 0.5 × bar vol)'ü
RETEST_TOL_SD = 0.5
SETUP_SIZE = {"retest": 1.0, "none": 0.5, "breakout": 0.0}  # hedefin çarpanı; kapılar sadece azaltır
SIGNAL_FALLBACK = {"hurst": 0.5, "regime": "unclear", "setup": "none"}  # veri yetersiz/geçersiz (contracts 0.6.1)
# T-017 ortalamaya dönüş (O-U) kolu: sadece ranging + anlamlı O-U. Spot, açığa satış yok.
OU_T_MAX = -2.5  # b'nin t istatistiği en fazla bu (Hurst'ten bağımsız ikinci kanıt)
OU_HL_MIN_H, OU_HL_MAX_H = 1.0, 12.0  # anlamlı yarı ömür aralığı (saat)
MR_ENTRY_Z, MR_EXIT_Z = -1.5, -0.25  # giriş z ≤ −1.5; elde pozisyon varken z ≥ −0.25 → çıkış; arası tut
MR_BUDGET_FRAC = 0.25  # MR kolu toplam deploy tabanının en fazla %25'i
MR_SIZE_FRAC = 0.5  # MR coin hedefi = momentum coin tavanının yarısı
OU_FALLBACK = {"half_life_h": None, "z": None, "significant": False, "sleeve": "none"}
MIN_RETURNS = 10  # bir coinin geçerli sayılması için gereken en az getiri (lookback daha kısaysa o)
CURVE_N = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 30, 50]
CENT = Decimal("0.01")
WHERE = "engine.decide"


def _err(code, message, at_ms, context=None):
    return {"code": code, "message": message, "at_ms": at_ms, "where": WHERE, "context": context or {}}


def _f(x) -> float:
    if isinstance(x, bool):
        return math.nan
    try:
        return float(x)
    except (TypeError, ValueError):
        return math.nan


def _int(x, default=0) -> int:
    try:
        return int(x) if not isinstance(x, bool) else default
    except (TypeError, ValueError):
        return default


def _clean(x, nd=4):
    """JSON-güvenli sayı: NaN/inf → None."""
    if x is None:
        return None
    x = float(x)
    return round(x, nd) if math.isfinite(x) else None


def _cents(x: float) -> Decimal:
    """float → sıfıra doğru kuruşa yuvarlanmış Decimal."""
    return Decimal(repr(float(x))).quantize(CENT, rounding=ROUND_DOWN)


def _price_str(x: float) -> str:
    return format(Decimal(f"{x:.10g}"), "f") if math.isfinite(x) and x > 0 else "0"


def _raw_closes(snap: dict, inst: str):
    """Artan zaman sıralı kapanış listesi. `closes` (artan) ya da OKX ham `candles` ([ts,o,h,l,c,...], her sırada)."""
    closes = (snap.get("closes") or {}).get(inst) if isinstance(snap.get("closes"), dict) else None
    if closes is not None:
        return closes
    rows = (snap.get("candles") or {}).get(inst) if isinstance(snap.get("candles"), dict) else None
    if not rows:
        return None
    try:
        return [r[4] for r in sorted(rows, key=lambda r: int(r[0]))]
    except (TypeError, ValueError, IndexError, KeyError):
        return None


def _analyze(raw, lookback: int, bar_hours: float = 1.0) -> dict:
    """Bir coinin lookback penceresi: geçerliyse getiriler + trend + bar vol, değilse HOLD sebebi."""
    if not isinstance(raw, (list, tuple)) or not raw:
        return {"ok": False, "why": "Not enough data (no prices)"}
    vals = np.array([_f(x) for x in raw], dtype=float)
    lb = min(lookback, len(vals) - 1)
    need = max(2, min(lookback, MIN_RETURNS))
    if lb < need:
        return {"ok": False, "why": f"Not enough data ({len(vals)} prices, need {need + 1})"}
    win = vals[-(lb + 1):]
    if not np.isfinite(win).all() or (win <= 0).any():
        return {"ok": False, "why": "Bad price data, skipping (missing or invalid price)"}
    rets = win[1:] / win[:-1] - 1.0
    sd = float(rets.std(ddof=1))
    if not sd > 1e-12:
        return {"ok": False, "why": "Price is flat, no signal"}
    # raporlanan H: [0,1]'e kırpılmış, 2 ondalık; rejim aynı sayıdan → reason/metrik/karar tutarlı (contracts 0.6.1)
    h = hurst_dfa(rets)
    h = round(min(1.0, max(0.0, h)), 2) if math.isfinite(h) else SIGNAL_FALLBACK["hurst"]
    regime = "ranging" if h < HURST_RANGING else "trending" if h > HURST_TRENDING else "unclear"
    setup = breakout_setup(win, max(RETEST_TOL_MIN, RETEST_TOL_SD * sd))
    return {"ok": True, "rets": rets, "trend": float(win[-1] / win[0] - 1.0), "sd": sd, "lb": lb, "last": float(win[-1]),
            "hurst": h, "regime": regime, "setup": setup, "ou": _ou_signal(win, bar_hours, regime)}


def _ou_signal(win, bar_hours: float, regime: str) -> dict:
    """T-017: O-U özeti (2 ondalık; karar da raporlanan sayıdan) + kol: ranging+anlamlı → mean_reversion,
    trending/unclear → momentum, ranging+anlamsız → none."""
    f = ou_fit(np.log(win), bar_hours)
    hl = round(f["half_life_h"], 2) if f["half_life_h"] is not None and math.isfinite(f["half_life_h"]) else None
    z = round(f["z"], 2) if f["z"] is not None and math.isfinite(f["z"]) else None
    sig = bool(hl is not None and z is not None and f["t"] <= OU_T_MAX and OU_HL_MIN_H <= hl <= OU_HL_MAX_H)
    sleeve = "momentum" if regime != "ranging" else "mean_reversion" if sig else "none"
    return {"half_life_h": hl, "z": z, "significant": sig, "sleeve": sleeve}


def _mr_target(inf: dict, cur: float, mr_usdt: float):
    """T-017 MR kolu: (hedef USDT, reason) ya da None (MR bu coinde işlem önermez → momentum/T-014 sonucu kalır).
    Giriş: z ≤ −1.5 → hedef mr_usdt (mevcudun altına inmez). Elde pozisyon: z ≥ −0.25 → 0 (çıkış), arası → tut."""
    z, hl, h = inf["ou"]["z"], inf["ou"]["half_life_h"], inf["hurst"]
    if z <= MR_ENTRY_Z and mr_usdt > cur:
        return mr_usdt, (f"Ranging market (Hurst {h:.2f}) and price {-z:.1f} std devs below its average "
                         f"(half-life {hl:.0f}h): small mean-reversion buy")
    if cur <= 0:
        return None
    if z >= MR_EXIT_Z:
        return 0.0, "Price back near its average: mean-reversion exit"
    return cur, f"Ranging market (Hurst {h:.2f}), price {-z:.1f} std devs below its average: holding mean-reversion position"


def _last_price(snap: dict, inst: str, raw) -> float:
    lp = _f((snap.get("last") or {}).get(inst)) if isinstance(snap.get("last"), dict) else math.nan
    if math.isfinite(lp) and lp > 0:
        return lp
    if isinstance(raw, (list, tuple)):
        for x in reversed(raw):
            v = _f(x)
            if math.isfinite(v) and v > 0:
                return v
    return math.nan


def decide(market_snapshot, positions, cfg) -> dict:
    """Karar üret.

    market_snapshot: {"cycle_id": int, "at_ms": int, "closes": {inst: [artan sıralı kapanışlar]}
                      | "candles": {inst: OKX ham satırları}, "last": {inst: "fiyat"} (ops.)}
    positions: state.portfolio biçimi {"equity_usdt", "cash_usdt", "positions": [{"inst_id", "value_usdt"|"size_base"}],
               "peak_equity_usdt" (ops., kill switch için)}
    Dönüş: {"ok": bool, "payload": <decision.md döngü payload'ı> | None, "metrics": <state.metrics> | None,
            "errors": [hata nesnesi]}. `payload` aynen hash'lenecek nesnedir; metrics/errors hash'e girmez.
    """
    snap_ok = isinstance(market_snapshot, dict)
    at_ms = _int(market_snapshot.get("at_ms")) if snap_ok else 0
    cfg_errors = validate_config(cfg)
    if cfg_errors:
        msg = "Config invalid: " + "; ".join(f"{e['field']}: {e['message']}" for e in cfg_errors)
        return {"ok": False, "payload": None, "metrics": None,
                "errors": [_err("CONFIG_INVALID", msg, at_ms, {"errors": cfg_errors})]}
    try:
        return _decide(market_snapshot if snap_ok else {}, positions, cfg, [] if snap_ok else
                       [_err("SNAPSHOT_INVALID", "Market snapshot is not an object", at_ms)])
    except Exception as e:  # agent döngüsü durmamalı: hepsi HOLD (HOLD da commit edilir) + hata nesnesi
        snap = market_snapshot if snap_ok else {}
        cycle_id, at_ms = _int(snap.get("cycle_id")), _int(snap.get("at_ms"))
        decisions = [
            {"cycle_id": cycle_id, "agent": cfg["agent_name"], "mode": cfg["mode"], "dry_run": cfg["dry_run"],
             "inst_id": c, "action": "HOLD", "size_usdt": "0", "ref_price": "0", "target_weight_pct": 0,
             "reason": f"Engine error, no trades ({type(e).__name__})", "decided_at_ms": at_ms}
            for c in sorted(cfg["coins"])
        ]
        payload = {"cycle_id": cycle_id, "agent": cfg["agent_name"], "mode": cfg["mode"], "dry_run": cfg["dry_run"],
                   "decided_at_ms": at_ms, "decisions": decisions}
        return {"ok": False, "payload": payload, "metrics": None,
                "errors": [_err("ENGINE_ERROR", f"{type(e).__name__}: {e}", at_ms)]}


def _decide(snap: dict, positions, cfg: dict, errors: list) -> dict:
    coins = sorted(cfg["coins"])
    cycle_id, at_ms = _int(snap.get("cycle_id")), _int(snap.get("at_ms"))
    ann = math.sqrt(525600 / bar_minutes(cfg["candle_bar"]))  # 7/24 kripto: yıllık bar sayısının kökü
    tv = float(cfg["target_vol_pct"])
    min_o, max_o = to_decimal(cfg["min_order_usdt"]), to_decimal(cfg["max_order_usdt"])
    max_deploy = to_decimal(cfg["max_total_deploy_usdt"])

    # --- piyasa verisi ---
    raws = {c: _raw_closes(snap, c) for c in coins}
    info = {c: _analyze(raws[c], cfg["lookback_bars"], bar_minutes(cfg["candle_bar"]) / 60.0) for c in coins}
    price = {c: _last_price(snap, c, raws[c]) for c in coins}

    # --- portföy ---
    port = positions if isinstance(positions, dict) else {"positions": positions if isinstance(positions, list) else []}
    pos_val: dict[str, float] = {}
    for p in port.get("positions") or []:
        if not isinstance(p, dict) or p.get("inst_id") not in info:
            continue
        v = _f(p.get("value_usdt"))
        if not math.isfinite(v):
            v = _f(p.get("size_base")) * price[p["inst_id"]]
        if math.isfinite(v) and v > 0:
            pos_val[p["inst_id"]] = pos_val.get(p["inst_id"], 0.0) + v
    invested = sum(pos_val.values())
    cash = _f(port.get("cash_usdt"))
    equity = _f(port.get("equity_usdt"))
    if not math.isfinite(equity) and math.isfinite(cash):
        equity = cash + invested
    equity_ok = math.isfinite(equity) and equity > 0
    if not equity_ok:
        errors.append(_err("PORTFOLIO_INVALID", "Account value missing or invalid; all coins HOLD", at_ms))
    peak = _f(port.get("peak_equity_usdt"))
    dd_pct = (1.0 - equity / peak) * 100.0 if equity_ok and math.isfinite(peak) and peak > 0 else 0.0
    kill = dd_pct >= float(cfg["kill_switch_drawdown_pct"])

    # --- korelasyon / Holy Grail (geçerli bütün coinler, ortak kuyruk penceresi) ---
    V = [c for c in coins if info[c]["ok"]]
    n = len(V)
    m = min((len(info[c]["rets"]) for c in V), default=0)
    R = np.column_stack([info[c]["rets"][-m:] for c in V]) if n else np.zeros((0, 0))
    cov = np.atleast_2d(np.cov(R, rowvar=False)) if n else np.zeros((0, 0))
    corr = corr_matrix(R) if n else np.zeros((0, 0))
    rho = avg_corr(corr) if n >= 2 else None
    ne = n_eff(n, rho) if rho is not None else (1.0 if n == 1 else None)
    srp = sr_portfolio(SR_SINGLE, n, rho) if rho is not None else (SR_SINGLE if n == 1 else None)
    curve = [{"n": k, "sr": round(s, 4)} for k in CURVE_N
             if rho is not None and math.isfinite(s := sr_portfolio(SR_SINGLE, k, rho))] or [{"n": 1, "sr": SR_SINGLE}]

    # --- hedef ağırlıklar ---
    trend_idx = [i for i, c in enumerate(V) if info[c]["trend"] > 0]
    hrp = np.zeros(n)
    if trend_idx:
        sub = np.ix_(trend_idx, trend_idx)
        hrp[trend_idx] = hrp_weights(cov[sub], corr[sub])
    pvol = lambda w: float(math.sqrt(max(float(w @ cov @ w), 0.0)) * ann * 100.0) if n else 0.0
    pv_raw = pvol(hrp)
    scale = min(1.0, tv / pv_raw) if pv_raw > 0 else 1.0
    sigma = np.array([info[c]["sd"] * ann * 100.0 for c in V])
    cap = np.minimum(float(cfg["max_position_pct"]) / 100.0, float(cfg["risk_budget_pct"]) / sigma) if n else sigma
    w = np.minimum(hrp * scale, cap) if n else hrp
    pv = pvol(w)
    weight = dict(zip(V, w.tolist()))
    # T-017 MR kolu: coin hedefi = min(momentum tavanının yarısı, tek varlık vol hedefi); kol toplamı ≤ %25
    w_mr = {c: float(min(MR_SIZE_FRAC * cap[i], tv / sigma[i])) for i, c in enumerate(V)}
    mr_coins = [c for c in V if info[c]["ou"]["sleeve"] == "mean_reversion"]

    # --- kararlar ---
    deploy_base = min(equity, float(max_deploy)) if equity_ok else 0.0
    budget_left = max(Decimal(0), max_deploy - _cents(invested))
    cash_left = _cents(cash) if math.isfinite(cash) else budget_left
    mr_left = max(Decimal(0), _cents(MR_BUDGET_FRAC * deploy_base - sum(pos_val.get(c, 0.0) for c in mr_coins)))
    decisions = []
    for c in coins:
        cur = pos_val.get(c, 0.0)
        cur_w = round(cur / equity * 100.0, 2) if equity_ok else 0
        action, size, tw = "HOLD", Decimal(0), cur_w
        if kill:
            reason = f"Safety stop: losses hit the limit, no trades (down {dd_pct:.1f}%, limit {cfg['kill_switch_drawdown_pct']}%)"
        elif not equity_ok:
            reason = "Account balance unknown, no trades"
        elif not info[c]["ok"]:
            reason = info[c]["why"]
        else:
            tr, tw = info[c]["trend"], round(weight[c] * 100.0, 2)
            target = target_u = weight[c] * deploy_base
            ne_s = f"{ne:.1f}" if ne is not None and math.isfinite(ne) else "many"
            if tr > 0:
                # T-014 kapıları: alım hedefini mult × hedefe indirir; mevcut pozisyon [mult × hedef, hedef] arasında
                # ise dokunulmaz (kapı satış üretmez), hedefin üstündeyse eski kural gibi kırpılır.
                h, regime, setup = info[c]["hurst"], info[c]["regime"], info[c]["setup"]
                mult = 0.0 if regime == "ranging" else SETUP_SIZE[setup]
                target = min(target, max(mult * target, cur))
                tw = round(target / deploy_base * 100.0, 2) if deploy_base > 0 else 0
                if regime == "ranging":
                    reason = f"Market is ranging (Hurst {h:.2f}), momentum buys paused"
                elif setup == "breakout":
                    reason = "Breakout not retested yet"
                else:
                    reason = f"Price trending up ({tr:+.1%}), target {tw:g}% of funds ({ne_s} independent bets)"
                    if scale < 1.0:
                        reason += f"; size cut to keep risk near {tv:g}% (was {pv_raw:.0f}%)"
                    reason += "; breakout + retest confirmed" if setup == "retest" else "; no breakout yet, half size"
            else:
                reason = f"Price trending down ({tr:+.1%}), " + ("moving to cash" if cur > 0 else "staying in cash")
            mr = _mr_target(info[c], cur, w_mr[c] * deploy_base) if c in mr_coins else None
            if mr is not None:  # T-017: ranging + anlamlı O-U → kararı MR kolu verir
                target, reason = mr
                tw = round(target / deploy_base * 100.0, 2) if deploy_base > 0 else 0
            if info[c]["lb"] < cfg["lookback_bars"]:
                reason += f"; short history ({info[c]['lb']} of {cfg['lookback_bars']} bars)"
            diff, diff_u = _cents(target - cur), _cents(target_u - cur)
            # nakit/bütçe kapısız alım boyutuyla tüketilir: bir coinin kapısı boşalttığı pay başka coine geçmez (R-009-1)
            size_u = min(diff_u, max_o, budget_left, cash_left) if diff_u >= min_o else Decimal(0)
            size_u = size_u if size_u >= min_o else Decimal(0)
            if abs(diff) < min_o:
                if diff != 0:
                    reason += f"; change too small to trade ({abs(diff)} < {min_o} USDT minimum)"
            elif diff > 0:
                size = min(diff, max_o, budget_left, cash_left, mr_left) if mr is not None else min(diff, size_u)
                if size >= min_o:
                    action = "BUY"
                else:
                    size = Decimal(0)
                    reason += (f"; spending limit reached (budget left {budget_left}, cash {cash_left} USDT"
                               + (f", mean-reversion budget {mr_left} USDT)" if mr is not None else ")"))
            else:
                action, size = "SELL", min(-diff, max_o)
                if tr > 0 and mr is None:
                    reason += "; trimming to target"
            # MR alımı kendi boyutunu tüketir; kapısız momentum payından az tüketmez (sonraki coinlerin bütçesi büyümez)
            spent = max(size_u, size if action == "BUY" else Decimal(0)) if mr is not None else size_u
            budget_left -= spent
            cash_left -= spent
            if mr is not None and action == "BUY":
                mr_left -= size
        decisions.append({
            "cycle_id": cycle_id, "agent": cfg["agent_name"], "mode": cfg["mode"], "dry_run": cfg["dry_run"],
            "inst_id": c, "action": action, "size_usdt": format(size.quantize(CENT, rounding=ROUND_DOWN), "f") if action != "HOLD" else "0",
            "ref_price": _price_str(price[c]), "target_weight_pct": tw, "reason": reason, "decided_at_ms": at_ms,
        })

    payload = {"cycle_id": cycle_id, "agent": cfg["agent_name"], "mode": cfg["mode"], "dry_run": cfg["dry_run"],
               "decided_at_ms": at_ms, "decisions": decisions}
    # PSR: trend seçimi aynı pencereden yapıldığı için seçili portföyde hep ~1 çıkar (look-ahead);
    # bu yüzden trend filtresi olmadan bütün geçerli coinlerin HRP portföyünde hesaplanır.
    port_r = R @ hrp_weights(cov, corr) if n else None
    metrics = {
        "avg_corr": _clean(rho), "n_assets": n, "n_eff": _clean(ne), "sr_single_assumed": SR_SINGLE,
        "sr_portfolio_est": _clean(srp), "holy_grail_curve": curve,
        "corr_matrix": {"labels": V, "values": [[_clean(x) for x in row] for row in corr.tolist()]},
        "hrp_weights_pct": {c: _clean(hrp[i] * 100.0, 2) for i, c in enumerate(V)},
        "target_weights_pct": {d["inst_id"]: d["target_weight_pct"] for d in decisions},
        "trend_pct": {c: _clean(info[c]["trend"] * 100.0, 2) for c in V},
        "vol_pct": {c: _clean(s, 2) for c, s in zip(V, sigma.tolist())},
        "portfolio_vol_raw_pct": _clean(pv_raw, 2), "portfolio_vol_pct": _clean(pv, 2),
        "psr": _clean(psr(port_r)) if port_r is not None else None, "psr_basis": "hrp_all_valid_in_sample",
        "window_bars": m, "drawdown_pct": _clean(dd_pct, 2), "kill_switch": kill,
        "signals": {c: {**{k: info[c][k] for k in SIGNAL_FALLBACK}, "ou": dict(info[c]["ou"])} if info[c]["ok"]
                    else {**SIGNAL_FALLBACK, "ou": dict(OU_FALLBACK)} for c in coins},
    }
    return {"ok": not errors, "payload": payload, "metrics": metrics, "errors": errors}
