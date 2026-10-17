import pytest

from grail_engine import validate_config


def fields(errors):
    return {e["field"] for e in errors}


def test_example_config_is_valid(cfg):
    assert validate_config(cfg) == []


def test_empty_coins(cfg):
    cfg["coins"] = []
    errs = validate_config(cfg)
    assert "coins" in fields(errs)
    assert all(e["message"] for e in errs)


def test_max_position_pct_over_100(cfg):
    cfg["max_position_pct"] = 150
    assert "max_position_pct" in fields(validate_config(cfg))


@pytest.mark.parametrize(
    "field,value",
    [
        ("coins", ["BTC-USDT", "BTC-USDT"]),
        ("coins", ["btc"]),
        ("dry_run", "yes"),
        ("lookback_bars", 1),
        ("lookback_bars", True),
        ("candle_bar", "1hour"),
        ("target_vol_pct", 0),
        ("max_order_usdt", "abc"),
        ("max_order_usdt", "-5"),
        ("kill_switch_drawdown_pct", 101),
        ("cycle_seconds", 0),
    ],
)
def test_invalid_fields(cfg, field, value):
    cfg[field] = value
    assert field in fields(validate_config(cfg))


def test_min_order_above_max_order(cfg):
    cfg["min_order_usdt"] = "20"
    assert "min_order_usdt" in fields(validate_config(cfg))


def test_missing_field_and_non_dict():
    assert validate_config({})  # boş değil
    assert validate_config(None)[0]["field"] == "<config>"
