"""Config doğrulama (contracts/config.example.json). Hata listesi döner, istisna fırlatmaz."""
from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation

BAR_RE = re.compile(r"^(\d+)([mHDWM])(utc)?$")
_BAR_MINUTES = {"m": 1, "H": 60, "D": 1440, "W": 10080, "M": 43200}
INST_RE = re.compile(r"^[A-Z0-9]{1,20}-([A-Z0-9]{2,10})$")


def bar_minutes(bar: str) -> int | None:
    m = BAR_RE.match(bar) if isinstance(bar, str) else None
    return int(m.group(1)) * _BAR_MINUTES[m.group(2)] if m and int(m.group(1)) > 0 else None


def to_decimal(x) -> Decimal | None:
    """Para/miktar değeri: ondalık string (sayı da kabul). Geçersizse None."""
    if isinstance(x, bool) or x is None:
        return None
    try:
        d = Decimal(str(x).strip())
    except (InvalidOperation, ValueError):
        return None
    return d if d.is_finite() else None


def _is_num(x) -> bool:
    return isinstance(x, (int, float)) and not isinstance(x, bool) and x == x and abs(x) != float("inf")


def validate_config(cfg) -> list[dict]:
    """Geçerliyse [] döner; değilse [{"field": ..., "message": ...}, ...]."""
    if not isinstance(cfg, dict):
        return [{"field": "<config>", "message": "config bir JSON nesnesi (dict) olmalı"}]
    errs: list[dict] = []

    def err(field, msg):
        errs.append({"field": field, "message": msg})

    def need(field):
        if field not in cfg:
            err(field, "zorunlu alan eksik")
            return False
        return True

    quote = cfg.get("quote", "USDT")
    if need("quote") and quote != "USDT":
        err("quote", f"sadece 'USDT' destekleniyor, gelen: {quote!r}")

    if need("coins"):
        coins = cfg["coins"]
        if not isinstance(coins, list) or not coins:
            err("coins", "boş olmayan bir liste olmalı (ör. [\"BTC-USDT\"])")
        else:
            bad = [c for c in coins if not (isinstance(c, str) and (m := INST_RE.match(c)) and m.group(1) == quote)]
            if bad:
                err("coins", f"OKX spot instId biçiminde ve '-{quote}' ile bitmeli: {bad}")
            if len(set(map(str, coins))) != len(coins):
                err("coins", "tekrar eden coin var")

    if need("mode") and cfg["mode"] not in ("live", "demo"):
        err("mode", f"'live' veya 'demo' olmalı, gelen: {cfg['mode']!r}")
    if need("dry_run") and not isinstance(cfg["dry_run"], bool):
        err("dry_run", "true/false olmalı")
    if need("agent_name") and not (isinstance(cfg["agent_name"], str) and cfg["agent_name"].strip()):
        err("agent_name", "boş olmayan metin olmalı")

    if need("cycle_seconds"):
        v = cfg["cycle_seconds"]
        if not (_is_num(v) and v >= 10):
            err("cycle_seconds", "en az 10 saniye olmalı")
    if need("candle_bar") and bar_minutes(cfg["candle_bar"]) is None:
        err("candle_bar", f"OKX bar biçimi olmalı (ör. '1m', '15m', '1H', '4H', '1D'), gelen: {cfg['candle_bar']!r}")
    if need("lookback_bars"):
        v = cfg["lookback_bars"]
        if not (isinstance(v, int) and not isinstance(v, bool) and 2 <= v <= 5000):
            err("lookback_bars", "2 ile 5000 arasında tamsayı olmalı")

    for f in ("risk_budget_pct", "max_position_pct", "target_vol_pct", "kill_switch_drawdown_pct"):
        if need(f):
            v = cfg[f]
            if not (_is_num(v) and 0 < v <= 100):
                err(f, "yüzde: 0'dan büyük, en çok 100 olmalı (0.2 değil 20 = %20)")

    money = {}
    for f in ("max_order_usdt", "min_order_usdt", "max_total_deploy_usdt"):
        if need(f):
            d = to_decimal(cfg[f])
            if d is None or d <= 0:
                err(f, f"pozitif ondalık string olmalı (ör. \"10\"), gelen: {cfg[f]!r}")
            else:
                money[f] = d
    if {"min_order_usdt", "max_order_usdt"} <= money.keys() and money["min_order_usdt"] > money["max_order_usdt"]:
        err("min_order_usdt", "min_order_usdt, max_order_usdt'den büyük olamaz")
    if {"max_order_usdt", "max_total_deploy_usdt"} <= money.keys() and money["max_order_usdt"] > money["max_total_deploy_usdt"]:
        err("max_order_usdt", "max_order_usdt, max_total_deploy_usdt'den büyük olamaz")
    return errs
