"""T-014: trend sinyalinin önündeki iki kapı (Hurst rejimi + kırılım/retest). Kapılar sadece azaltır."""
from decimal import Decimal

import numpy as np
import pytest

import grail_engine.decision as mod
from conftest import make_closes, make_portfolio, make_snapshot
from grail_engine import decide
from grail_engine.stats import breakout_setup, hurst_dfa


def ar_closes(phi, seed, n=49, drift=0.002, vol=0.01):
    """Getirileri AR(1) (phi) olan kapanışlar: phi>0 süreklilik, phi<0 ortalamaya dönüş, 0 rastgele yürüyüş."""
    rng = np.random.default_rng(seed)
    e = rng.standard_normal(n + 50)
    x = np.zeros_like(e)
    for i in range(1, len(e)):
        x[i] = phi * x[i - 1] + e[i]
    r = drift + vol * x[50:50 + n - 1]
    return [float(v) for v in 100 * np.exp(np.concatenate([[0.0], np.cumsum(r)]))]


def one(cfg, closes, positions=None):
    cfg["coins"] = ["BTC-USDT"]
    res = decide(make_snapshot({"BTC-USDT": closes}), make_portfolio(positions=positions), cfg)
    return res["payload"]["decisions"][0], res["metrics"]["signals"]["BTC-USDT"]


# --- 1) rejim: Hurst (DFA, küçük örnek düzeltmeli) ---
def test_hurst_small_sample_correction_centers_white_noise():
    rng = np.random.default_rng(7)
    hs = [hurst_dfa(rng.standard_normal(48)) for _ in range(200)]
    assert abs(np.mean(hs) - 0.5) < 0.05  # düzeltmesiz DFA 48 barda ~0.62 verir


def test_random_walk_is_unclear_and_not_blocked(cfg):
    d, s = one(cfg, ar_closes(0.0, seed=2))
    assert s["regime"] == "unclear" and 0.45 <= s["hurst"] <= 0.55
    assert d["action"] == "BUY" and not d["reason"].startswith("Market is ranging")


def test_persistent_trend_is_trending(cfg):
    d, s = one(cfg, ar_closes(0.7, seed=2))
    assert s["regime"] == "trending" and 0.55 < s["hurst"] <= 1.0
    assert d["action"] == "BUY"


def test_mean_reverting_is_ranging_and_holds(cfg):
    closes = ar_closes(-0.7, seed=1)
    assert closes[-1] > closes[0]  # trend pozitif: kapı olmasa momentum alımı olurdu
    d, s = one(cfg, closes)
    assert s["regime"] == "ranging" and s["hurst"] < 0.45
    assert d["action"] == "HOLD" and d["size_usdt"] == "0"
    assert d["reason"] == f"Market is ranging (Hurst {s['hurst']:.2f}), momentum buys paused"


# --- 2) setup: önceki range tepesi kırılımı + retest ---
RANGE = [100, 101, 100.5, 102, 101, 100.2, 101.5, 100.8] * 4 + [101]  # 33 bar, tepe 102


def test_setup_retest():
    assert breakout_setup(RANGE + [101.5] * 6 + [103, 104, 104.5, 103, 102.1, 102.5, 103, 103.5, 104, 104.2], 0.002) == "retest"


def test_setup_breakout_without_retest():
    assert breakout_setup(RANGE + [101.5] * 6 + [103, 104, 105, 106, 105.5, 106, 107, 108, 108.5, 109], 0.002) == "breakout"


def test_setup_no_breakout():
    assert breakout_setup(RANGE + [101.5] * 6 + [101.8, 101.2, 101.9, 101, 101.4, 101.6, 101.7, 101.9, 101.5, 101.8], 0.002) == "none"


def test_setup_has_no_look_ahead():
    """t anındaki etiket sadece t'ye kadar olan kapanışlara bağlı: geleceğe ne eklenirse eklensin önek aynı sonucu verir."""
    base = RANGE + [101.5] * 6 + [103, 104, 105, 106, 105.5, 106, 107, 108, 108.5, 109]
    for future in ([102.0, 102.05, 103.0], [90.0, 80.0], [200.0]):
        series = base + future
        assert breakout_setup(series[:len(base)], 0.002) == "breakout"


@pytest.fixture
def unclear_regime(monkeypatch):
    """Setup kapısını tek başına sınamak için rejimi 'unclear'a sabitle."""
    monkeypatch.setattr(mod, "hurst_dfa", lambda r: 0.5)


def with_setup(monkeypatch, label):
    monkeypatch.setattr(mod, "breakout_setup", lambda c, tol: label)


def test_retest_full_none_half_breakout_hold(cfg, unclear_regime, monkeypatch):
    closes = make_closes(n=49, seed=5, drift=0.001, vol=0.001)
    with_setup(monkeypatch, "retest")
    full, s = one(dict(cfg), closes)
    assert s["setup"] == "retest" and full["action"] == "BUY"
    assert full["reason"].endswith("; breakout + retest confirmed")
    with_setup(monkeypatch, "none")
    half, _ = one(dict(cfg), closes)
    assert half["action"] == "BUY" and half["reason"].endswith("; no breakout yet, half size")
    assert half["target_weight_pct"] == pytest.approx(full["target_weight_pct"] / 2, abs=0.01)
    with_setup(monkeypatch, "breakout")
    held, _ = one(dict(cfg), closes)
    assert held["action"] == "HOLD" and held["size_usdt"] == "0" and held["reason"] == "Breakout not retested yet"


def test_real_setup_labels_flow_into_decide(cfg, unclear_regime):
    retest = RANGE + [101.5] * 6 + [103, 104, 104.5, 103, 102.1, 102.5, 103, 103.5, 104, 104.2]
    breakout = RANGE + [101.5] * 6 + [103, 104, 105, 106, 105.5, 106, 107, 108, 108.5, 109]
    d, s = one(dict(cfg), [float(x) for x in retest])
    assert s["setup"] == "retest" and d["action"] == "BUY" and "breakout + retest confirmed" in d["reason"]
    d, s = one(dict(cfg), [float(x) for x in breakout])
    assert s["setup"] == "breakout" and d["action"] == "HOLD" and d["reason"] == "Breakout not retested yet"


# --- kapılar sadece azaltır: asla BUY üretmez/büyütmez, satış üretmez ---
@pytest.mark.parametrize("seed", range(1, 9))
@pytest.mark.parametrize("held", ["0", "3", "8"])
def test_gates_only_reduce(cfg, monkeypatch, seed, held):
    closes = ar_closes(0.0, seed=seed)
    pos = [{"inst_id": "BTC-USDT", "value_usdt": held}] if held != "0" else []
    gated, _ = one(dict(cfg), closes, pos)
    monkeypatch.setattr(mod, "hurst_dfa", lambda r: 0.6)
    monkeypatch.setattr(mod, "breakout_setup", lambda c, tol: "retest")  # çarpan 1 = kapısız davranış
    ungated, _ = one(dict(cfg), closes, pos)
    buy = lambda d: Decimal(d["size_usdt"]) if d["action"] == "BUY" else Decimal(0)
    sell = lambda d: Decimal(d["size_usdt"]) if d["action"] == "SELL" else Decimal(0)
    assert buy(gated) <= buy(ungated)
    assert sell(gated) <= sell(ungated)
    assert gated["target_weight_pct"] <= ungated["target_weight_pct"]


def test_signals_in_metrics_for_every_config_coin(cfg):
    """R-009-3: anahtarlar config coinleri; geçersiz coin 0.5/unclear/none (contracts 0.6.1)."""
    snap = make_snapshot({c: make_closes(seed=i + 1) for i, c in enumerate(sorted(cfg["coins"]))})
    snap["closes"]["BTC-USDT"] = [100.0] * 49  # düz → geçersiz
    del snap["closes"]["SOL-USDT"]  # veri yok
    m = decide(snap, make_portfolio(), cfg)["metrics"]
    assert set(m["signals"]) == set(cfg["coins"])
    assert m["signals"]["BTC-USDT"] == m["signals"]["SOL-USDT"] == {"hurst": 0.5, "regime": "unclear", "setup": "none"}
    for s in m["signals"].values():
        assert set(s) == {"hurst", "regime", "setup"}
        assert isinstance(s["hurst"], float) and 0.0 <= s["hurst"] <= 1.0
        assert s["regime"] in {"trending", "unclear", "ranging"} and s["setup"] in {"none", "breakout", "retest"}


# --- R-009-2: raporlanan H [0,1]'de, rejim raporlanan sayıyla tutarlı ---
@pytest.mark.parametrize("raw, rep, regime", [
    (0.449996, 0.45, "unclear"), (0.4449, 0.44, "ranging"), (0.550004, 0.55, "unclear"),
    (0.5551, 0.56, "trending"), (1.37, 1.0, "trending"), (-0.2, 0.0, "ranging"), (float("nan"), 0.5, "unclear"),
])
def test_reported_hurst_clipped_and_consistent(cfg, monkeypatch, raw, rep, regime):
    monkeypatch.setattr(mod, "hurst_dfa", lambda r: raw)
    d, s = one(cfg, ar_closes(0.0, seed=2))
    assert s["hurst"] == rep and s["regime"] == regime
    if regime == "ranging":
        assert d["reason"] == f"Market is ranging (Hurst {rep:.2f}), momentum buys paused"


# --- R-009-1: bir coinin kapısının boşalttığı nakit/bütçe başka coine geçmez ---
def five_coin_snap():
    """AVAX ayırt edilebilsin diye 200'den başlar (breakout_setup sadece kapanışları görür)."""
    coins = sorted(["AVAX-USDT", "BTC-USDT", "ETH-USDT", "OKB-USDT", "SOL-USDT"])
    return make_snapshot({c: make_closes(seed=i + 1, start=200.0 if c == "AVAX-USDT" else 100.0)
                          for i, c in enumerate(coins)})


def test_reviewer_scenario_freed_cash_does_not_turn_hold_into_buy(cfg, monkeypatch):
    port = make_portfolio(equity="50", cash="5", positions=[{"inst_id": "OKB-USDT", "value_usdt": "45"}])
    monkeypatch.setattr(mod, "hurst_dfa", lambda r: 0.6)
    monkeypatch.setattr(mod, "breakout_setup", lambda c, tol: "retest")
    ungated = {d["inst_id"]: d for d in decide(five_coin_snap(), port, cfg)["payload"]["decisions"]}
    assert ungated["AVAX-USDT"]["action"] == "BUY" and ungated["AVAX-USDT"]["size_usdt"] == "5.00"
    assert ungated["BTC-USDT"]["action"] == "HOLD"
    monkeypatch.setattr(mod, "breakout_setup", lambda c, tol: "breakout" if c[-1] > 150 else "retest")
    gated = {d["inst_id"]: d for d in decide(five_coin_snap(), port, cfg)["payload"]["decisions"]}
    assert gated["AVAX-USDT"]["action"] == "HOLD" and gated["AVAX-USDT"]["reason"] == "Breakout not retested yet"
    assert gated["BTC-USDT"]["action"] == "HOLD"
    assert not [c for c, d in gated.items() if d["action"] == "BUY"]


@pytest.mark.parametrize("seed", range(1, 6))
@pytest.mark.parametrize("cash", ["4", "9", "30", "100"])
def test_gates_only_reduce_multi_coin(cfg, monkeypatch, seed, cash):
    """Gerçek kapılar vs nötr kapılar (çarpan 1), 5 coin, nakit kısıtlı/kısıtsız: coin başına BUY ≤ kapısız, yeni BUY yok."""
    snap = make_snapshot({c: ar_closes(0.0, seed=seed * 10 + i) for i, c in enumerate(sorted(cfg["coins"]))})
    port = make_portfolio(equity="100", cash=cash,
                          positions=[] if cash == "100" else [{"inst_id": "OKB-USDT", "value_usdt": str(100 - int(cash))}])
    gated = {d["inst_id"]: d for d in decide(snap, port, cfg)["payload"]["decisions"]}
    monkeypatch.setattr(mod, "hurst_dfa", lambda r: 0.6)
    monkeypatch.setattr(mod, "breakout_setup", lambda c, tol: "retest")
    ungated = {d["inst_id"]: d for d in decide(snap, port, cfg)["payload"]["decisions"]}
    for c in gated:
        g, u = gated[c], ungated[c]
        if g["action"] == "BUY":
            assert u["action"] == "BUY" and Decimal(g["size_usdt"]) <= Decimal(u["size_usdt"]), c
        if g["action"] == "SELL":
            assert u["action"] == "SELL" and g["size_usdt"] == u["size_usdt"], c
    total = lambda res: sum(Decimal(d["size_usdt"]) for d in res.values() if d["action"] == "BUY")
    assert total(gated) <= total(ungated)
