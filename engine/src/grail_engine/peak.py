"""Kill switch zirvesi: tüm zamanlar yerine KAYAN pencere (son KILL_SWITCH_WINDOW_H saatin en yüksek hesap değeri).

decide() durumsuzdur; zirveyi çağıran verir (`portfolio.peak_equity_usdt`). Agents ve replay aynı mantığı bu modülden kullanır:
her döngüde `peak = tracker.update(t_ms, equity)` → `peak_equity_usdt = peak`.
Pencere dolunca eski zirve kendiliğinden düşer; düşüş pencere içinde sürdükçe zirve değişmez (erken serbest kalma yok).
"""
from __future__ import annotations

import math
from collections import deque

KILL_SWITCH_WINDOW_H = 168  # lookback 168 ile tutarlı: haftalık zirve
HOUR_MS = 3_600_000


def rolling_peak(points, now_ms: int, window_h: float = KILL_SWITCH_WINDOW_H) -> float:
    """points: [(t_ms, equity)]; (now − window, now] aralığındaki en yüksek sonlu equity. Yoksa NaN."""
    lo = now_ms - window_h * HOUR_MS
    vals = [float(e) for t, e in points if lo < int(t) <= now_ms and math.isfinite(float(e))]
    return max(vals) if vals else math.nan


class PeakTracker:
    """Artan zamanlı (t_ms, equity) örnekleri; update() son window_h saatin zirvesini döndürür (şimdiki değer dahil)."""

    def __init__(self, window_h: float = KILL_SWITCH_WINDOW_H, points=None):
        self.window_ms = int(window_h * HOUR_MS)
        self.points: deque = deque((int(t), float(e)) for t, e in (points or []))

    def update(self, t_ms: int, equity: float) -> float:
        self.points.append((int(t_ms), float(equity)))
        while self.points and self.points[0][0] <= t_ms - self.window_ms:
            self.points.popleft()
        return max(e for _, e in self.points if math.isfinite(e))

    def to_list(self) -> list:
        """Kalıcı saklama için (agents control.json): [[t_ms, equity], ...]."""
        return [[t, e] for t, e in self.points]
