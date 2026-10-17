import json
from pathlib import Path

import numpy as np
import pytest

CONTRACTS = Path(__file__).resolve().parents[2] / "contracts"


@pytest.fixture
def cfg():
    """contracts/config.example.json, test başına taze kopya. lookback_bars testlerde 48'e sabit: test verisi
    (make_closes, sentetik seriler, beklenen pencere) 48 barlık pencereye göre kurulu; örnek config'in canlı değeri
    (168) testleri etkilemesin. Motor davranışı config'ten ölçeklenir (out/lookback-168.md)."""
    cfg = json.loads((CONTRACTS / "config.example.json").read_text(encoding="utf-8"))
    cfg["lookback_bars"] = TEST_LOOKBACK
    return cfg


TEST_LOOKBACK = 48


@pytest.fixture
def no_gates(monkeypatch):
    """T-014 kapılarını nötrle (rejim trending, setup retest → çarpan 1): emir limiti/bozuk veri testleri kapıdan bağımsız."""
    import grail_engine.decision as mod

    monkeypatch.setattr(mod, "hurst_dfa", lambda r: 0.6)
    monkeypatch.setattr(mod, "breakout_setup", lambda c, tol: "retest")


def make_closes(n=169, drift=0.001, vol=0.001, seed=1, start=100.0):
    """Artan zaman sıralı kapanışlar (log-normal yürüyüş, sabit seed)."""
    rng = np.random.default_rng(seed)
    r = drift + vol * rng.standard_normal(n - 1)
    return [float(x) for x in start * np.exp(np.concatenate([[0.0], np.cumsum(r)]))]


def make_snapshot(closes_by_inst, cycle_id=7, at_ms=1760700000000):
    return {"cycle_id": cycle_id, "at_ms": at_ms, "closes": closes_by_inst}


def make_portfolio(equity="100", cash=None, positions=None, **extra):
    p = {"equity_usdt": equity, "cash_usdt": cash if cash is not None else equity, "positions": positions or []}
    p.update(extra)
    return p
