"""T-017: Ornstein-Uhlenbeck ortalamaya dönüş kolu (sadece ranging + anlamlı O-U, spot, açığa satış yok)."""
import math
from decimal import Decimal

import numpy as np
import pytest

import grail_engine.decision as mod
from conftest import make_portfolio, make_snapshot
from grail_engine import decide
from grail_engine.stats import ou_fit

HL2 = math.log(2) / 2  # yarı ömür 2 saat


def ou_log(theta, n, seed, sigma=0.01, mu=math.log(100)):
    rng = np.random.default_rng(seed)
    x = np.empty(n)
    x[0] = mu
    for i in range(1, n):
        x[i] = x[i - 1] + theta * (mu - x[i - 1]) + sigma * rng.standard_normal()
    return x


def ou_closes(theta, seed, n=49, start=100.0):
    return [float(v) for v in np.exp(ou_log(theta, n, seed, mu=math.log(start)))]


def rw_log(n, seed, sigma=0.01):
    rng = np.random.default_rng(seed)
    return math.log(100) + np.concatenate([[0.0], np.cumsum(sigma * rng.standard_normal(n - 1))])


def significant(f):
    return f["t"] <= mod.OU_T_MAX and f["half_life_h"] is not None and 1 <= f["half_life_h"] <= 12


@pytest.fixture
def ranging(monkeypatch):
    """Rejimi ranging'e sabitle (H 0.40): O-U kolunu tek başına sına."""
    monkeypatch.setattr(mod, "hurst_dfa", lambda r: 0.40)


def one(cfg, closes, positions=None, **port):
    cfg["coins"] = ["BTC-USDT"]
    res = decide(make_snapshot({"BTC-USDT": closes}), make_portfolio(positions=positions, **port), cfg)
    return res["payload"]["decisions"][0], res["metrics"]["signals"]["BTC-USDT"]


# --- O-U tahmini ---
def test_ou_recovers_known_half_life_long_series():
    f = ou_fit(ou_log(math.log(2) / 5, 3000, seed=1))
    assert f["half_life_h"] == pytest.approx(5.0, rel=0.1) and f["t"] < -10


@pytest.mark.parametrize("seed", range(1, 8))
def test_ou_48_bars_known_theta_is_significant(seed):
    f = ou_fit(ou_log(HL2, 49, seed))
    assert significant(f) and 1.0 <= f["half_life_h"] <= 4.0  # gerçek 2 sa; 48 barda θ yukarı sapmalı


def test_random_walk_mostly_not_significant():
    rate = np.mean([significant(ou_fit(rw_log(49, s))) for s in range(1, 401)])
    assert rate < 0.25  # t ≤ −2.5 birim kökte ~%10–15 düzey (Dickey-Fuller); Hurst ikinci kanıt


def test_ou_uses_only_the_window_no_look_ahead(cfg, ranging):
    x = ou_closes(HL2, seed=5, n=60)
    _, s = one(dict(cfg), x)
    f = ou_fit(np.log(x[-49:]))  # lookback 48 → son 49 kapanış; sonrası yok
    assert s["ou"]["z"] == round(f["z"], 2) and s["ou"]["half_life_h"] == round(f["half_life_h"], 2)
    _, s_prefix = one(dict(cfg), x[:55])
    f_prefix = ou_fit(np.log(x[6:55]))
    assert s_prefix["ou"]["z"] == round(f_prefix["z"], 2)


# --- karar: giriş / çıkış / tut / anlamsız / trend ---
def test_ranging_significant_low_z_small_buy(cfg, ranging):
    d, s = one(cfg, ou_closes(HL2, seed=5))
    assert s["regime"] == "ranging" and s["ou"]["significant"] and s["ou"]["z"] <= -1.5
    assert s["ou"]["sleeve"] == "mean_reversion"
    assert d["action"] == "BUY" and d["reason"].isascii()
    assert d["reason"].startswith("Ranging market (Hurst 0.40) and price 1.")
    assert d["reason"].endswith("small mean-reversion buy")
    assert Decimal(d["size_usdt"]) <= Decimal(cfg["max_order_usdt"])
    assert d["target_weight_pct"] <= mod.MR_BUDGET_FRAC * 100


def test_position_back_near_average_sells(cfg, ranging):
    closes = ou_closes(HL2, seed=2)
    pos = [{"inst_id": "BTC-USDT", "value_usdt": "3"}]
    d, s = one(cfg, closes, pos, cash="97")
    assert s["ou"]["significant"] and s["ou"]["z"] >= -0.25
    assert d["action"] == "SELL" and d["size_usdt"] == "3.00"
    assert d["reason"] == "Price back near its average: mean-reversion exit"


def test_position_in_hold_band_is_kept(cfg, ranging):
    closes = ou_closes(HL2, seed=1)
    pos = [{"inst_id": "BTC-USDT", "value_usdt": "3"}]
    d, s = one(cfg, closes, pos, cash="97")
    assert s["ou"]["significant"] and -1.5 < s["ou"]["z"] < -0.25
    assert d["action"] == "HOLD" and d["reason"].endswith("holding mean-reversion position")


def test_no_position_no_entry_keeps_t014_text(cfg, ranging):
    closes = ou_closes(HL2, seed=2)  # z > −1.5, pozisyon yok → MR işlem önermez
    d, s = one(cfg, closes)
    assert s["ou"]["sleeve"] == "mean_reversion" and d["action"] == "HOLD"
    assert d["reason"].startswith(("Market is ranging (Hurst 0.40)", "Price trending down"))


def test_not_significant_no_mean_reversion(cfg, ranging):
    seed = next(s for s in range(1, 50) if not significant(ou_fit(rw_log(49, s))))
    closes = [float(v) for v in np.exp(rw_log(49, seed))]
    d, s = one(cfg, closes, [{"inst_id": "BTC-USDT", "value_usdt": "3"}], cash="97")
    assert not s["ou"]["significant"] and s["ou"]["sleeve"] == "none"
    assert "mean-reversion" not in d["reason"] and d["action"] != "BUY"


def test_trending_series_uses_momentum_not_mr(cfg):
    from test_gates import ar_closes

    d, s = one(cfg, ar_closes(0.7, seed=2))
    assert s["regime"] == "trending" and s["ou"]["sleeve"] == "momentum"
    assert "mean-reversion" not in d["reason"]


# --- limitler: %25 kol tavanı, max_order, kill switch ---
def five_mr_snap(cfg):
    coins = sorted(cfg["coins"])
    return make_snapshot({c: ou_closes(HL2, seed=5, start=100.0 * (i + 1)) for i, c in enumerate(coins)})


def test_mr_sleeve_capped_at_25pct_of_deploy_base(cfg, ranging):
    res = decide(five_mr_snap(cfg), make_portfolio(equity="100", cash="100"), cfg)
    buys = [d for d in res["payload"]["decisions"] if d["action"] == "BUY"]
    assert buys and all("mean-reversion buy" in d["reason"] for d in buys)
    base = min(Decimal("100"), Decimal(cfg["max_total_deploy_usdt"]))
    assert sum(Decimal(d["size_usdt"]) for d in buys) <= Decimal(str(mod.MR_BUDGET_FRAC)) * base
    assert all(Decimal(d["size_usdt"]) <= Decimal(cfg["max_order_usdt"]) for d in buys)
    # tavan gerçekten bağlıyor: 5 coin de girmek istiyor, en az biri MR bütçesi yüzünden HOLD
    assert any("mean-reversion budget" in d["reason"] for d in res["payload"]["decisions"] if d["action"] == "HOLD")


def test_mr_cap_counts_existing_mr_positions(cfg, ranging):
    pos = [{"inst_id": "AVAX-USDT", "value_usdt": "12"}]  # MR kolunda 12 USDT zaten var; tavan 12.5
    res = decide(five_mr_snap(cfg), make_portfolio(equity="100", cash="88", positions=pos), cfg)
    assert not [d for d in res["payload"]["decisions"] if d["action"] == "BUY"]


def test_kill_switch_blocks_mr(cfg, ranging):
    res = decide(five_mr_snap(cfg), make_portfolio(equity="90", cash="90", peak_equity_usdt="100"), cfg)
    assert {d["action"] for d in res["payload"]["decisions"]} == {"HOLD"}


# --- değişmez: MR yeni alımı SADECE ranging + anlamlı + z ≤ −1.5 iken, %25 içinde üretir ---
@pytest.mark.parametrize("seed", range(1, 13))
@pytest.mark.parametrize("hurst", [0.40, 0.50])
def test_mr_buys_only_under_all_three_conditions(cfg, monkeypatch, seed, hurst):
    monkeypatch.setattr(mod, "hurst_dfa", lambda r: hurst)
    coins = sorted(cfg["coins"])
    rng = np.random.default_rng(seed)
    snap = make_snapshot({c: (ou_closes(HL2, seed=seed * 7 + i) if rng.random() < 0.6 else
                              [float(v) for v in np.exp(rw_log(49, seed * 7 + i))]) for i, c in enumerate(coins)})
    res = decide(snap, make_portfolio(equity="100", cash="100"), cfg)
    sig = res["metrics"]["signals"]
    mr_total = Decimal(0)
    for d in res["payload"]["decisions"]:
        if "mean-reversion buy" in d["reason"]:
            s = sig[d["inst_id"]]
            assert d["action"] == "BUY"
            assert s["regime"] == "ranging" and s["ou"]["significant"] and s["ou"]["z"] <= -1.5
            mr_total += Decimal(d["size_usdt"])
        elif hurst == 0.40:
            assert d["action"] != "BUY"  # ranging: momentum alımı durur, başka kaynaktan alım yok
    assert mr_total <= Decimal("12.5")  # %25 × min(100, 50)
