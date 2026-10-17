import json
from pathlib import Path

import numpy as np
import pytest

CONTRACTS = Path(__file__).resolve().parents[2] / "contracts"


@pytest.fixture
def cfg():
    """contracts/config.example.json, test başına taze kopya."""
    return json.loads((CONTRACTS / "config.example.json").read_text(encoding="utf-8"))


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
