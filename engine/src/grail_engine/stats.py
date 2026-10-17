"""Saf istatistik fonksiyonları: getiri, korelasyon, Holy Grail, PSR. I/O yok."""
from __future__ import annotations

import math

import numpy as np
from scipy import stats as _st


def sr_portfolio(sr_i: float, n: int, rho: float) -> float:
    """Holy Grail: n eşit SR'li, ortalama korelasyonu rho olan varlıktan portföy SR'si."""
    denom = 1.0 / n + (1.0 - 1.0 / n) * rho
    return sr_i / math.sqrt(denom) if denom > 0 else math.inf


def n_eff(n: int, rho: float) -> float:
    """Efektif bağımsız bahis sayısı."""
    denom = 1.0 / n + (1.0 - 1.0 / n) * rho
    return 1.0 / denom if denom > 0 else math.inf


def returns_from_closes(closes) -> np.ndarray:
    """Basit getiriler r_t = c_t / c_{t-1} - 1 (artan zaman sırası)."""
    c = np.asarray(closes, dtype=float)
    return c[1:] / c[:-1] - 1.0


def corr_matrix(returns_2d) -> np.ndarray:
    """T x N getiri matrisinden N x N korelasyon (köşegen 1, [-1, 1] aralığına kırpılmış)."""
    R = np.asarray(returns_2d, dtype=float)
    n = R.shape[1]
    if n == 1:
        return np.ones((1, 1))
    c = np.nan_to_num(np.corrcoef(R, rowvar=False), nan=0.0)
    c = np.clip(c, -1.0, 1.0)
    np.fill_diagonal(c, 1.0)
    return c


def cov_to_corr(cov) -> np.ndarray:
    cov = np.asarray(cov, dtype=float)
    sd = np.sqrt(np.clip(np.diag(cov), 1e-300, None))
    c = np.clip(cov / np.outer(sd, sd), -1.0, 1.0)
    np.fill_diagonal(c, 1.0)
    return c


def avg_corr(corr) -> float | None:
    """Köşegen dışı elemanların ortalaması; N < 2 ise None."""
    c = np.asarray(corr, dtype=float)
    n = c.shape[0]
    if n < 2:
        return None
    return float(c[~np.eye(n, dtype=bool)].mean())


def psr(returns, sr_benchmark: float = 0.0) -> float | None:
    """Probabilistic Sharpe Ratio (Bailey & López de Prado), bar başına SR ile. Hesaplanamazsa None."""
    r = np.asarray(returns, dtype=float)
    r = r[np.isfinite(r)]
    t = r.size
    if t < 3:
        return None
    sd = r.std(ddof=1)
    if not sd > 1e-15:
        return None
    sr = r.mean() / sd
    g3 = float(_st.skew(r))
    g4 = float(_st.kurtosis(r, fisher=False))
    denom = 1.0 - g3 * sr + (g4 - 1.0) / 4.0 * sr * sr
    if not denom > 0:
        return None
    return float(_st.norm.cdf((sr - sr_benchmark) * math.sqrt(t - 1) / math.sqrt(denom)))
