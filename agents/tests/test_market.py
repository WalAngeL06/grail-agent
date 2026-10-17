from copy import deepcopy

import pytest

from grail_agents.config import AgentConfig, GrailError
from grail_agents.market import normalize_ticker, normalize_portfolio, validate_instruments, confirmed_candles


def test_ticker_contract_and_percentage(ticker_row):
    assert normalize_ticker(ticker_row) == {"inst_id": "BTC-USDT", "last": "60000", "change_24h_pct": 20.0, "at_ms": 1000}


@pytest.mark.parametrize("value", ["NaN", "Infinity", "0", "-1", ""])
def test_bad_ticker_fails_closed(ticker_row, value):
    ticker_row["last"] = value
    with pytest.raises(GrailError):
        normalize_ticker(ticker_row)


def test_missing_open_has_null_percentage(ticker_row):
    ticker_row["open24h"] = "0"
    assert normalize_ticker(ticker_row)["change_24h_pct"] is None


def test_portfolio_values_in_usdt_not_total_equity_usd():
    balance = [{"totalEq": "999", "details": [
        {"ccy": "USDT", "cashBal": "80", "availBal": "75"},
        {"ccy": "BTC", "cashBal": "0.001", "availBal": "0.0009"}]}]
    result = normalize_portfolio(balance, {"BTC-USDT": "60000"})
    assert result["equity_usdt"] == "140"
    assert result["cash_usdt"] == "75"
    assert result["positions"] == [{"inst_id": "BTC-USDT", "size_base": "0.001", "available_base": "0.0009", "value_usdt": "60", "weight_pct": 42.857142857142854}]


def test_unknown_holding_cannot_silently_reduce_exposure():
    with pytest.raises(GrailError, match="VALUATION"):
        normalize_portfolio([{"details": [{"ccy": "DOGE", "cashBal": "10", "availBal": "10"}]}], {})


def test_empty_account_is_zero():
    assert normalize_portfolio([{"details": []}], {}) == {"equity_usdt": "0", "cash_usdt": "0", "positions": []}


def test_instruments_validate_spot_and_expose_minimum(instrument_row):
    rules = validate_instruments([instrument_row], ("BTC-USDT",))
    assert rules["BTC-USDT"]["minSz"] == "0.00001"


@pytest.mark.parametrize("change", [{"state": "suspend"}, {"instType": "SWAP"}, {"quoteCcy": "USD"}, {"minSz": "NaN"}])
def test_bad_instrument_rejected(instrument_row, change):
    instrument_row.update(change)
    with pytest.raises(GrailError):
        validate_instruments([instrument_row], ("BTC-USDT",))


def test_missing_config_coin_is_explicit(instrument_row):
    with pytest.raises(GrailError, match="ETH-USDT"):
        validate_instruments([instrument_row], ("BTC-USDT", "ETH-USDT"))


def test_candles_exclude_open_bar_and_sort_oldest_first():
    rows = [["3000", "1", "2", "1", "2", "1", "1", "1", "0"], ["2000", "1", "2", "1", "2", "1", "1", "1", "1"], ["1000", "1", "2", "1", "1", "1", "1", "1", "1"]]
    assert [r[0] for r in confirmed_candles(rows, 2)] == ["1000", "2000"]
    with pytest.raises(GrailError, match="CANDLES"):
        confirmed_candles(rows, 3)


def test_config_uses_current_contract(cfg_dict):
    cfg = AgentConfig.from_mapping(cfg_dict)
    assert cfg.dry_run is True and cfg.lookback_bars == 48


@pytest.mark.parametrize("change", [{"dry_run": "false"}, {"okx_site": "global"}, {"max_order_usdt": "NaN"}, {"max_order_usdt": "0"}, {"coins": ["BTC-USDT-SWAP"]}, {"coins": []}, {"quote": "USD"}, {"kill_switch_drawdown_pct": 101}, {"mode": "demo"}])
def test_bad_config_cannot_reach_exchange(cfg_dict, change):
    cfg_dict.update(change)
    with pytest.raises(GrailError):
        AgentConfig.from_mapping(cfg_dict)
