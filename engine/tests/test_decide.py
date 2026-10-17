import json
from decimal import Decimal

import pytest

from conftest import make_closes, make_portfolio, make_snapshot
from grail_engine import decide

COINS5 = ["AVAX-USDT", "BTC-USDT", "ETH-USDT", "OKB-USDT", "SOL-USDT"]
DECISION_KEYS = {
    "cycle_id", "agent", "mode", "dry_run", "inst_id", "action", "size_usdt",
    "ref_price", "target_weight_pct", "reason", "decided_at_ms",
}


def by_inst(result):
    return {d["inst_id"]: d for d in result["payload"]["decisions"]}


def up_market(coins=COINS5):
    return make_snapshot({c: make_closes(seed=i + 1, drift=0.001) for i, c in enumerate(coins)})


def down_market(coins=COINS5):
    return make_snapshot({c: make_closes(seed=i + 1, drift=-0.002) for i, c in enumerate(coins)})


# --- sözleşme biçimi ---
def test_payload_matches_contract(cfg):
    res = decide(up_market(), make_portfolio(), cfg)
    assert res["ok"] is True and res["errors"] == []
    p = res["payload"]
    assert set(p) == {"cycle_id", "agent", "mode", "dry_run", "decided_at_ms", "decisions"}
    assert p["cycle_id"] == 7 and p["decided_at_ms"] == 1760700000000 and p["dry_run"] is True
    assert [d["inst_id"] for d in p["decisions"]] == sorted(cfg["coins"])
    for d in p["decisions"]:
        assert set(d) == DECISION_KEYS
        assert d["action"] in {"BUY", "SELL", "HOLD"}
        assert isinstance(d["size_usdt"], str) and isinstance(d["ref_price"], str)
        assert d["reason"].isascii()
        if d["action"] == "HOLD":
            assert d["size_usdt"] == "0"
    # kanonik JSON'a girebilmeli; metrikler NaN/inf içermemeli
    json.dumps(p, sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False)
    json.dumps(res["metrics"], allow_nan=False)


def test_metrics_shape(cfg):
    m = decide(up_market(), make_portfolio(), cfg)["metrics"]
    for k in ["avg_corr", "n_assets", "n_eff", "sr_single_assumed", "sr_portfolio_est",
              "holy_grail_curve", "corr_matrix", "hrp_weights_pct", "portfolio_vol_pct", "psr"]:
        assert k in m
    assert m["n_assets"] == 5
    assert m["corr_matrix"]["labels"] == sorted(cfg["coins"])
    assert len(m["corr_matrix"]["values"]) == 5
    assert m["holy_grail_curve"][0] == {"n": 1, "sr": 0.5}


def test_up_market_buys_within_limits(cfg):
    res = decide(up_market(), make_portfolio(), cfg)
    buys = [d for d in res["payload"]["decisions"] if d["action"] == "BUY"]
    assert buys
    total = sum(Decimal(d["size_usdt"]) for d in buys)
    assert total <= Decimal(cfg["max_total_deploy_usdt"])
    for d in buys:
        assert Decimal(cfg["min_order_usdt"]) <= Decimal(d["size_usdt"]) <= Decimal(cfg["max_order_usdt"])
        assert d["target_weight_pct"] <= cfg["max_position_pct"]


# --- determinizm ---
def test_deterministic(cfg):
    a = decide(up_market(), make_portfolio(), cfg)
    b = decide(up_market(), make_portfolio(), cfg)
    assert a == b


# --- trend negatif ---
def test_all_down_no_positions_all_hold(cfg):
    res = decide(down_market(), make_portfolio(), cfg)
    assert {d["action"] for d in res["payload"]["decisions"]} == {"HOLD"}


def test_all_down_with_position_sells(cfg):
    pos = [{"inst_id": "BTC-USDT", "size_base": "0.0003", "value_usdt": "20"}]
    res = decide(down_market(), make_portfolio(equity="100", cash="80", positions=pos), cfg)
    d = by_inst(res)
    assert d["BTC-USDT"]["action"] == "SELL"
    assert Decimal(d["BTC-USDT"]["size_usdt"]) == Decimal(cfg["max_order_usdt"])  # 20 > max 10
    assert d["BTC-USDT"]["target_weight_pct"] == 0
    assert all(d[c]["action"] == "HOLD" for c in COINS5 if c != "BTC-USDT")


# --- bozuk veri: çökme yok, ilgili coin HOLD ---
def test_constant_nan_and_single_price(cfg, no_gates):
    snap = up_market()
    snap["closes"]["BTC-USDT"] = [100.0] * 169
    nan_series = make_closes(seed=2)
    nan_series[150] = float("nan")
    snap["closes"]["ETH-USDT"] = nan_series
    snap["closes"]["SOL-USDT"] = [100.0]
    snap["closes"]["AVAX-USDT"] = ["abc", None] + make_closes(seed=4)[-20:]  # kısa seri, pencere içinde çöp
    old_nan = make_closes(n=200, seed=5)
    old_nan[5] = float("nan")  # lookback penceresinin (son 169) dışında
    snap["closes"]["OKB-USDT"] = old_nan
    pos = [{"inst_id": "BTC-USDT", "value_usdt": "10"}]  # bozuk veride satış da yok
    res = decide(snap, make_portfolio(positions=pos, cash="90"), cfg)
    d = by_inst(res)
    assert d["BTC-USDT"]["action"] == "HOLD" and "Price is flat" in d["BTC-USDT"]["reason"]
    assert d["ETH-USDT"]["action"] == "HOLD" and "Bad price data" in d["ETH-USDT"]["reason"]
    assert d["SOL-USDT"]["action"] == "HOLD" and "Not enough data" in d["SOL-USDT"]["reason"]
    assert d["AVAX-USDT"]["action"] == "HOLD" and "Bad price data" in d["AVAX-USDT"]["reason"]
    assert d["OKB-USDT"]["action"] == "BUY" and "Bad price data" not in d["OKB-USDT"]["reason"]
    json.dumps(res["metrics"], allow_nan=False)


def test_missing_coin_in_snapshot(cfg):
    snap = up_market(coins=["BTC-USDT"])
    res = decide(snap, make_portfolio(), cfg)
    d = by_inst(res)
    assert len(d) == 5
    assert d["ETH-USDT"]["action"] == "HOLD" and "Not enough data" in d["ETH-USDT"]["reason"]


# --- emir boyutu sınırları (tek coin, düşük vol: hedef = max_position_pct) ---
def single_cfg(cfg):
    cfg["coins"] = ["BTC-USDT"]
    return cfg


def test_diff_above_max_order_is_capped(cfg, no_gates):
    cfg = single_cfg(cfg)
    snap = make_snapshot({"BTC-USDT": make_closes(seed=5, drift=0.001, vol=0.001)})
    d = by_inst(decide(snap, make_portfolio(), cfg))["BTC-USDT"]
    assert d["action"] == "BUY"
    assert d["target_weight_pct"] == pytest.approx(30.0)  # 0.30 * 50 = 15 USDT hedef
    assert Decimal(d["size_usdt"]) == Decimal(cfg["max_order_usdt"])


def test_diff_below_min_order_is_hold(cfg):
    cfg = single_cfg(cfg)
    snap = make_snapshot({"BTC-USDT": make_closes(seed=5, drift=0.001, vol=0.001)})
    first = by_inst(decide(snap, make_portfolio(), cfg))["BTC-USDT"]
    target_usdt = first["target_weight_pct"] / 100 * 50
    pos = [{"inst_id": "BTC-USDT", "value_usdt": f"{target_usdt - 1:.2f}"}]  # fark 1 < min 2
    d = by_inst(decide(snap, make_portfolio(positions=pos), cfg))["BTC-USDT"]
    assert d["action"] == "HOLD" and d["size_usdt"] == "0"


def test_total_deploy_budget_caps_buys(cfg):
    pos = [{"inst_id": "BTC-USDT", "value_usdt": "46"}]  # 50 - 46 = 4 USDT bütçe kaldı
    res = decide(up_market(), make_portfolio(equity="200", cash="154", positions=pos), cfg)
    buys = [d for d in res["payload"]["decisions"] if d["action"] == "BUY"]
    assert sum(Decimal(d["size_usdt"]) for d in buys) <= Decimal("4")


def test_kill_switch_blocks_buys_but_allows_selling(cfg):
    """(a) %5+ düşüş → BUY yok; (d) SELL / nakde geçiş her zaman mümkün (pozisyon dondurulmaz)."""
    pos = [{"inst_id": "BTC-USDT", "value_usdt": "20"}]
    res = decide(down_market(), make_portfolio(equity="90", cash="70", positions=pos, peak_equity_usdt="100"), cfg)
    d = by_inst(res)
    assert res["metrics"]["kill_switch"] is True
    assert d["BTC-USDT"]["action"] == "SELL" and "safety stop on (down 10.0%)" in d["BTC-USDT"]["reason"]
    assert all(d[c]["action"] == "HOLD" and d[c]["reason"].startswith("Safety stop: losses hit the limit, no new buys")
               for c in COINS5 if c != "BTC-USDT")


@pytest.mark.parametrize("equity, kill", [("95", True), ("94", True), ("95.01", False)])
def test_kill_switch_no_buys_in_up_market(cfg, no_gates, equity, kill):
    """(a) eşik config'teki kill_switch_drawdown_pct (%5): tetikliyken hiç BUY yok, limitler aynen."""
    res = decide(up_market(), make_portfolio(equity=equity, peak_equity_usdt="100"), cfg)
    assert res["metrics"]["kill_switch"] is kill
    buys = [d for d in res["payload"]["decisions"] if d["action"] == "BUY"]
    if kill:
        assert not buys
    else:
        assert buys and all(Decimal(d["size_usdt"]) <= Decimal(cfg["max_order_usdt"]) for d in buys)


def test_kill_switch_releases_when_window_peak_rolls_off(cfg, no_gates):
    """(b) zirve 168 saatlik pencereden düşünce kendiliğinden serbest; (c) düşüş pencere içinde sürerken erken serbest kalmaz."""
    from grail_engine.peak import HOUR_MS, KILL_SWITCH_WINDOW_H, PeakTracker

    tr, t0 = PeakTracker(), 1_760_000_000_000
    tr.update(t0, 100.0)
    states = []
    for h in range(1, KILL_SWITCH_WINDOW_H + 3):
        eq = max(94.0, 100.0 - h * 0.5)  # 12 saatte %6 düşer, sonra 94'te kalır
        peak = tr.update(t0 + h * HOUR_MS, eq)
        res = decide(up_market(), make_portfolio(equity=str(eq), peak_equity_usdt=str(peak)), cfg)
        states.append((h, peak, res["metrics"]["kill_switch"], any(d["action"] == "BUY" for d in res["payload"]["decisions"])))
    for h, peak, kill, bought in states:
        if h < KILL_SWITCH_WINDOW_H:
            assert peak == 100.0  # 100'lük zirve pencerede
        if 10 <= h < KILL_SWITCH_WINDOW_H:
            assert kill and not bought  # düşüş ≥ %5 iken asla erken serbest yok
    h, peak, kill, bought = states[-1]
    assert peak < 100.0 and not kill and bought  # zirve pencereden çıktı → serbest


def test_rolling_peak_matches_tracker():
    from grail_engine.peak import HOUR_MS, PeakTracker, rolling_peak

    pts, tr, t0 = [], PeakTracker(window_h=3), 0
    for h, e in enumerate([100, 103, 101, 99, 98, 97]):
        pts.append((t0 + h * HOUR_MS, e))
        assert tr.update(t0 + h * HOUR_MS, e) == rolling_peak(pts, t0 + h * HOUR_MS, window_h=3)
    assert rolling_peak(pts, t0 + 5 * HOUR_MS, window_h=3) == 99  # 103 (h=1) pencereden çıktı


# --- hata nesnesi, istisna yok ---
def test_invalid_config_returns_error_object(cfg):
    cfg["coins"] = []
    res = decide(up_market(), make_portfolio(), cfg)
    assert res["ok"] is False and res["payload"] is None
    e = res["errors"][0]
    assert e["code"] == "CONFIG_INVALID" and e["where"] == "engine.decide" and e["context"]["errors"]


def test_garbage_inputs_do_not_raise(cfg):
    res = decide(None, None, cfg)
    assert res["ok"] is False
    assert {d["action"] for d in res["payload"]["decisions"]} == {"HOLD"}  # HOLD da commit edilir
    assert all(d["reason"] == "Account balance unknown, no trades" for d in res["payload"]["decisions"])


def test_unexpected_exception_becomes_hold_and_error(cfg, monkeypatch):
    import grail_engine.decision as mod

    def boom(*a, **k):
        raise ZeroDivisionError("x")

    monkeypatch.setattr(mod, "_decide", boom)
    res = decide(up_market(), make_portfolio(), cfg)
    assert res["ok"] is False and res["errors"][0]["code"] == "ENGINE_ERROR"
    assert {d["action"] for d in res["payload"]["decisions"]} == {"HOLD"}
    assert len(res["payload"]["decisions"]) == 5
    assert {d["reason"] for d in res["payload"]["decisions"]} == {"Engine error, no trades (ZeroDivisionError)"}


# --- reason: kullanıcıya sade İngilizce (T-009) ---
TURKISH = ["veri", "nakit", "fark", "butce", "hedef", "emir", "gecersiz", "hatasi", "portfoy", "yetersiz", "kapanis"]


def assert_plain(reason):
    assert reason.isascii() and reason[0].isupper()
    assert not any(w in reason.lower() for w in TURKISH), reason


def test_reasons_plain_english_up_and_down(cfg):
    up = decide(up_market(), make_portfolio(), cfg)["payload"]["decisions"]
    for d in up:
        assert_plain(d["reason"])
        if d["action"] == "BUY":
            assert d["reason"].startswith("Price trending up (+")
            assert "% of funds" in d["reason"] and "independent bets" in d["reason"]
    pos = [{"inst_id": "BTC-USDT", "value_usdt": "20"}]
    down = by_inst(decide(down_market(), make_portfolio(equity="100", cash="80", positions=pos), cfg))
    for d in down.values():
        assert_plain(d["reason"])
    assert down["BTC-USDT"]["reason"].startswith("Price trending down (-")
    assert "moving to cash" in down["BTC-USDT"]["reason"]
    assert "staying in cash" in down["ETH-USDT"]["reason"]


def test_reasons_plain_english_order_limits(cfg, no_gates):
    snap = make_snapshot({"BTC-USDT": make_closes(seed=5, drift=0.001, vol=0.001)})
    first = by_inst(decide(snap, make_portfolio(), single_cfg(cfg)))["BTC-USDT"]
    pos = [{"inst_id": "BTC-USDT", "value_usdt": f"{first['target_weight_pct'] / 100 * 50 - 1:.2f}"}]
    small = by_inst(decide(snap, make_portfolio(positions=pos), cfg))["BTC-USDT"]
    assert_plain(small["reason"])
    assert "change too small to trade" in small["reason"]


def test_reasons_plain_english_budget_limit(cfg, no_gates):
    pos = [{"inst_id": "BTC-USDT", "value_usdt": "46"}]
    res = decide(up_market(), make_portfolio(equity="200", cash="154", positions=pos), cfg)
    reasons = [d["reason"] for d in res["payload"]["decisions"]]
    for r in reasons:
        assert_plain(r)
    assert any("spending limit reached" in r for r in reasons)
    btc = by_inst(res)["BTC-USDT"]  # 46 > hedef: trend pozitifken de kırpılır
    assert btc["action"] == "SELL" and btc["reason"].endswith("; trimming to target")


def test_reasons_plain_english_bad_data(cfg):
    snap = up_market()
    snap["closes"]["BTC-USDT"] = []
    snap["closes"]["ETH-USDT"] = [100.0] * 5
    d = by_inst(decide(snap, make_portfolio(), cfg))
    assert d["BTC-USDT"]["reason"] == "Not enough data (no prices)"
    assert d["ETH-USDT"]["reason"] == "Not enough data (5 prices, need 11)"


def test_okx_raw_candles_any_order(cfg):
    closes = make_closes(seed=1)
    rows = [[str(1760000000000 + i * 3600000), "0", "0", "0", repr(c), "1"] for i, c in enumerate(closes)]
    rows.reverse()  # OKX en yeniyi önce verir
    snap = {"cycle_id": 7, "at_ms": 1760700000000, "candles": {"BTC-USDT": rows}}
    a = by_inst(decide(snap, make_portfolio(), single_cfg(cfg)))["BTC-USDT"]
    b = by_inst(decide(make_snapshot({"BTC-USDT": closes}), make_portfolio(), cfg))["BTC-USDT"]
    assert a["action"] == b["action"] and a["target_weight_pct"] == b["target_weight_pct"]
