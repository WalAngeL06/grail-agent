"""Validation shared by the transport and execution boundary."""
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
import re


class GrailError(ValueError):
    """Safe to display: contains a stable code and no exchange response text."""


class OrderRejected(GrailError):
    """A well-formed exchange sCode proves that no order was created."""
    def __init__(self, code):
        self.code = str(code)
        super().__init__(f"ATK_REJECTED_{self.code}: exchange explicitly rejected the order")


def number(value, field: str, *, positive=False) -> Decimal:
    try:
        result = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        raise GrailError(f"INVALID_NUMBER: {field}") from None
    if not result.is_finite() or result < 0 or (positive and result == 0):
        raise GrailError(f"INVALID_NUMBER: {field}")
    return result


def money(value: Decimal) -> str:
    return format(value.normalize(), "f")


def spot_id(value: str) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"[A-Z0-9]+-USDT", value):
        raise GrailError("SPOT_ONLY: expected BASE-USDT")
    return value


@dataclass(frozen=True)
class AgentConfig:
    coins: tuple[str, ...]
    dry_run: bool
    max_order_usdt: Decimal
    min_order_usdt: Decimal
    max_total_deploy_usdt: Decimal
    kill_switch_drawdown_pct: Decimal
    candle_bar: str
    lookback_bars: int

    @classmethod
    def from_mapping(cls, cfg: dict):
        if not isinstance(cfg, dict):
            raise GrailError("CONFIG: expected a JSON object")
        if cfg.get("okx_site") != "tr" or cfg.get("quote") != "USDT" or cfg.get("mode") != "live":
            raise GrailError("CONFIG: requires site=tr, quote=USDT, mode=live")
        dry = cfg.get("dry_run", True)
        if type(dry) is not bool:
            raise GrailError("CONFIG: dry_run must be a boolean")
        coins = cfg.get("coins")
        if not isinstance(coins, list) or not coins or not all(isinstance(coin, str) for coin in coins) or len(set(coins)) != len(coins):
            raise GrailError("CONFIG: coins must be a nonempty unique list")
        coins = tuple(spot_id(coin) for coin in coins)
        minimum = number(cfg.get("min_order_usdt"), "min_order_usdt", positive=True)
        maximum = number(cfg.get("max_order_usdt"), "max_order_usdt", positive=True)
        total = number(cfg.get("max_total_deploy_usdt"), "max_total_deploy_usdt", positive=True)
        drawdown = number(cfg.get("kill_switch_drawdown_pct"), "kill_switch_drawdown_pct", positive=True)
        lookback = cfg.get("lookback_bars")
        bar = cfg.get("candle_bar")
        if minimum > maximum or maximum > total or drawdown > 100:
            raise GrailError("CONFIG: inconsistent limits")
        if type(lookback) is not int or not 1 <= lookback <= 298:
            raise GrailError("CONFIG: lookback_bars must be 1..298")
        if bar not in {"1m", "3m", "5m", "15m", "30m", "1H", "2H", "4H", "6H", "12H", "1D", "1Dutc", "1W", "1Wutc"}:
            raise GrailError("CONFIG: unsupported candle_bar")
        return cls(coins, dry, maximum, minimum, total, drawdown, bar, lookback)
