"""Hierarchical Risk Parity (López de Prado, 2016). Saf fonksiyon."""
from __future__ import annotations

import numpy as np
from scipy.cluster.hierarchy import leaves_list, linkage
from scipy.spatial.distance import squareform

from .stats import cov_to_corr


def _cluster_var(cov: np.ndarray, idx: list[int]) -> float:
    sub = cov[np.ix_(idx, idx)]
    ivp = 1.0 / np.clip(np.diag(sub), 1e-300, None)
    ivp /= ivp.sum()
    return float(ivp @ sub @ ivp)


def hrp_weights(cov, corr=None) -> np.ndarray:
    """N x N kovaryanstan HRP ağırlıkları: toplam 1, hepsi >= 0."""
    cov = np.asarray(cov, dtype=float)
    n = cov.shape[0]
    if n == 0:
        return np.zeros(0)
    if n == 1:
        return np.ones(1)
    corr = cov_to_corr(cov) if corr is None else np.clip(np.nan_to_num(np.asarray(corr, float)), -1.0, 1.0)
    dist = np.sqrt(np.clip(0.5 * (1.0 - corr), 0.0, 1.0))
    dist = (dist + dist.T) / 2.0
    np.fill_diagonal(dist, 0.0)
    order = leaves_list(linkage(squareform(dist, checks=False), method="single")).tolist()

    w = np.ones(n)
    clusters = [order]
    while clusters:
        nxt = []
        for c in clusters:
            if len(c) < 2:
                continue
            left, right = c[: len(c) // 2], c[len(c) // 2 :]
            vl, vr = _cluster_var(cov, left), _cluster_var(cov, right)
            alpha = 1.0 - vl / (vl + vr) if vl + vr > 0 else 0.5
            w[left] *= alpha
            w[right] *= 1.0 - alpha
            nxt += [left, right]
        clusters = nxt
    w = np.clip(w, 0.0, None)
    return w / w.sum()
