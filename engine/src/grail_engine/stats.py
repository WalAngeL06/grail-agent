"""Saf istatistik fonksiyonları: getiri, korelasyon, Holy Grail, PSR. I/O yok."""
from __future__ import annotations

import math
from functools import lru_cache

import numpy as np
from scipy import stats as _st

DFA_MIN_SCALE = 4  # en küçük DFA penceresi (bar)
DFA_BIAS_SIMS = 400  # küçük örnek düzeltmesi için beyaz gürültü simülasyonu (sabit seed)
DFA_BIAS_SEED = 20261017


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


def _dfa_slope(x) -> float:
    """DFA-1 ham üssü: profil y = cumsum(x - ort), pencerelerde doğrusal trend çıkarılır, log F(s) ~ H log s."""
    x = np.asarray(x, dtype=float)
    n = x.size
    smax = n // 4
    if smax <= DFA_MIN_SCALE:
        return math.nan
    scales = np.unique(np.floor(np.geomspace(DFA_MIN_SCALE, smax, num=6)).astype(int))
    y = np.cumsum(x - x.mean())
    fs = []
    for s in scales:
        k = n // s
        segs = np.concatenate([y[:k * s].reshape(k, s), y[n - k * s:].reshape(k, s)])  # baştan + sondan
        t = np.arange(s, dtype=float)
        A = np.column_stack([t, np.ones(s)])
        coef, *_ = np.linalg.lstsq(A, segs.T, rcond=None)
        fs.append(math.sqrt(float(np.mean((segs.T - A @ coef) ** 2))))
    fs = np.array(fs)
    if not (fs > 0).all():
        return math.nan
    return float(np.polyfit(np.log(scales), np.log(fs), 1)[0])


@lru_cache(maxsize=64)
def _dfa_bias(n: int) -> float:
    """n uzunluklu beyaz gürültüde DFA ortalamasının 0.5'ten sapması (sabit seed → deterministik)."""
    rng = np.random.default_rng(DFA_BIAS_SEED)
    hs = [_dfa_slope(rng.standard_normal(n)) for _ in range(DFA_BIAS_SIMS)]
    return float(np.nanmean(hs)) - 0.5


def hurst_dfa(returns) -> float:
    """Getirilerden Hurst üssü (DFA-1, küçük örnek düzeltmeli: H_ham - E[H_ham | beyaz gürültü, n] + 0.5).
    ~0.5 rastgele yürüyüş, >0.5 süreklilik (trend), <0.5 ortalamaya dönüş. Hesaplanamazsa NaN."""
    r = np.asarray(returns, dtype=float)
    if r.size < 4 * (DFA_MIN_SCALE + 1) or not np.isfinite(r).all() or not r.std() > 1e-15:
        return math.nan
    h = _dfa_slope(r)
    return h - _dfa_bias(r.size) if math.isfinite(h) else math.nan


def breakout_setup(closes, tol: float) -> str:
    """Artan sıralı kapanışlarda (son bar dahil, sonrası yok) kırılım durumu.
    Range tepesi = pencerenin ilk 2/3'ünün en yükseği. Son kapanış tepenin üstünde değilse "none";
    üstündeyse ve kırılım barından SONRA bir kapanış tepeye (±tol oranı) geri gelip son kapanış yine üstteyse "retest";
    aksi halde "breakout"."""
    c = np.asarray(closes, dtype=float)
    k = max(2, c.size // 3)
    if c.size < k + 2:
        return "none"
    level = float(c[:-k].max())
    if not c[-1] > level:
        return "none"
    recent = c[-k:]
    first = int(np.nonzero(recent > level)[0][0])
    after = recent[first + 1:]
    if after.size and (np.abs(after / level - 1.0) <= tol).any():
        return "retest"
    return "breakout"


def ou_fit(log_closes, bar_hours: float = 1.0) -> dict:
    """Ornstein-Uhlenbeck (T-017): Δx_t = a + b·x_{t-1} + e (OLS, artan sıralı log kapanışlar, son bar dahil).
    θ = −b, yarı ömür = ln2/θ (saat), μ = −a/b, σ_eq = sd(e)/√(2θ), z = (x_son − μ)/σ_eq; t = b/se(b).
    b ≥ 0 ise yarı ömür/z yok (None). Hesaplanamazsa t NaN."""
    out = {"b": math.nan, "t": math.nan, "half_life_h": None, "z": None}
    x = np.asarray(log_closes, dtype=float)
    if x.size < 10 or not np.isfinite(x).all():
        return out
    X, dx = x[:-1], np.diff(x)
    Xc = X - X.mean()
    sxx = float(Xc @ Xc)
    if not sxx > 1e-18:
        return out
    b = float(Xc @ (dx - dx.mean())) / sxx
    a = float(dx.mean()) - b * float(X.mean())
    e = dx - a - b * X
    s2 = float(e @ e) / (X.size - 2)
    if not s2 > 0:
        return out
    out["b"], out["t"] = b, b / math.sqrt(s2 / sxx)
    if b < 0:
        theta = -b
        out["half_life_h"] = math.log(2) / theta * bar_hours
        sig_eq = float(e.std(ddof=1)) / math.sqrt(2 * theta)
        out["z"] = (float(x[-1]) + a / b) / sig_eq  # μ = −a/b
    return out


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
