import math

import numpy as np
import pytest

from conftest import make_closes
from grail_engine import avg_corr, corr_matrix, hrp_weights, n_eff, psr, returns_from_closes, sr_portfolio


# --- Holy Grail golden değerler (T-001) ---
def test_holy_grail_rho_06():
    assert sr_portfolio(0.5, 10, 0.6) == pytest.approx(0.625)
    assert n_eff(10, 0.6) == pytest.approx(1.5625)


def test_holy_grail_rho_0():
    assert sr_portfolio(0.5, 10, 0.0) == pytest.approx(1.5811, abs=1e-4)
    assert n_eff(10, 0.0) == pytest.approx(10.0)


@pytest.mark.parametrize("rho", [-0.9, -0.3, 0.0, 0.25, 0.6, 1.0])
def test_holy_grail_single_asset(rho):
    assert sr_portfolio(0.5, 1, rho) == pytest.approx(0.5)
    assert n_eff(1, rho) == pytest.approx(1.0)


def test_holy_grail_impossible_negative_corr_is_inf_not_crash():
    # 1/n + (1-1/n)*rho <= 0 → matematiksel olarak sınırsız; istisna yok
    assert math.isinf(n_eff(2, -1.0))


# --- Korelasyon ---
def test_identical_series_corr_is_one():
    r = returns_from_closes(make_closes(seed=3))
    c = corr_matrix(np.column_stack([r, r]))
    assert c[0, 1] == pytest.approx(1.0)
    assert avg_corr(c) == pytest.approx(1.0)


def test_avg_corr_is_mean_of_off_diagonal():
    c = np.array([[1.0, 0.2, 0.4], [0.2, 1.0, 0.6], [0.4, 0.6, 1.0]])
    assert avg_corr(c) == pytest.approx(0.4)


def test_returns_from_closes():
    assert returns_from_closes([100, 110, 99]) == pytest.approx([0.1, -0.1])


# --- HRP ---
def _cov(seeds):
    R = np.column_stack([returns_from_closes(make_closes(seed=s, vol=0.002 * (i + 1))) for i, s in enumerate(seeds)])
    return np.cov(R, rowvar=False), R


def test_hrp_weights_sum_to_one_and_nonnegative():
    cov, _ = _cov([1, 2, 3, 4, 5])
    w = hrp_weights(cov)
    assert w.shape == (5,)
    assert w.sum() == pytest.approx(1.0)
    assert (w >= 0).all()


def test_hrp_identical_series():
    r = returns_from_closes(make_closes(seed=9))
    R = np.column_stack([r, r])
    w = hrp_weights(np.cov(R, rowvar=False))
    assert w.sum() == pytest.approx(1.0)
    assert w == pytest.approx([0.5, 0.5])


def test_hrp_single_and_empty():
    assert hrp_weights(np.array([[0.04]])) == pytest.approx([1.0])
    assert hrp_weights(np.zeros((0, 0))).shape == (0,)


def test_hrp_prefers_lower_variance():
    cov = np.diag([0.01, 0.04])  # bağımsız, ikincisi 4x varyans
    w = hrp_weights(cov)
    assert w == pytest.approx([0.8, 0.2])


# --- PSR ---
def test_psr_direction_and_degenerate():
    rng = np.random.default_rng(0)
    base = rng.standard_normal(500) * 0.01
    up = psr(base - base.mean() + 0.002)
    down = psr(base - base.mean() - 0.002)
    assert 0.5 < up <= 1.0
    assert 0.0 <= down < 0.5
    assert psr(np.full(50, 0.01)) is None  # std=0
    assert psr([0.01]) is None  # yetersiz veri
