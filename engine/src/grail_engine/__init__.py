"""GRAIL quant engine: deterministik, saf (I/O yok) karar kütüphanesi."""
from .config import validate_config
from .decision import decide
from .hrp import hrp_weights
from .stats import avg_corr, corr_matrix, n_eff, psr, returns_from_closes, sr_portfolio

__all__ = [
    "avg_corr", "corr_matrix", "decide", "hrp_weights", "n_eff", "psr",
    "returns_from_closes", "sr_portfolio", "validate_config",
]
