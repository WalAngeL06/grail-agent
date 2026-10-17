import pytest

from grail_agents.__main__ import run_smoke
from grail_agents.config import GrailError


class ReadOnlyExchange:
    def __init__(self, instrument, ticker):
        self.instrument = instrument
        self.tick = ticker
        self.calls = []

    def instruments(self):
        self.calls.append("instruments")
        return [self.instrument]

    def ticker(self, inst):
        self.calls.append("ticker")
        return self.tick

    def balance(self):
        self.calls.append("balance")
        return [{"details": [{"ccy": "USDT", "cashBal": "100", "availBal": "100"}]}]

    def candles(self, inst, bar, limit):
        self.calls.append("candles")
        return [[str(i * 3600000), "60000", "61000", "59000", "60000", "1", "60000", "60000", "1"] for i in range(limit)]

    def _place_spot(self, _):
        raise AssertionError("A smoke command must never place an order")


def test_smoke_reads_account_and_market_and_simulates(cfg_dict, instrument_row, ticker_row):
    cfg_dict["coins"] = ["BTC-USDT"]
    client = ReadOnlyExchange(instrument_row, ticker_row)
    result = run_smoke(cfg_dict, client)
    assert result["ok"] is True and result["dry_run"] is True
    assert result["portfolio"]["cash_usdt"] == "100"
    assert result["market"][0]["last"] == "60000"
    assert result["candle_counts"] == {"BTC-USDT": 49}
    assert result["order"]["size_usdt"] == "2"
    assert result["order"]["order_status"] == "simulated"
    assert result["instruments"]["BTC-USDT"]["min_order_usdt_at_last"] == "0.6"
    assert set(client.calls) == {"instruments", "ticker", "balance", "candles"}


def test_smoke_refuses_live_config_before_any_exchange_call(cfg_dict, instrument_row, ticker_row):
    cfg_dict["dry_run"] = False
    client = ReadOnlyExchange(instrument_row, ticker_row)
    with pytest.raises(GrailError, match="SMOKE_DRY_RUN"):
        run_smoke(cfg_dict, client)
    assert client.calls == []


def test_smoke_includes_try_dust_in_usdt_equity(cfg_dict, instrument_row, ticker_row):
    cfg_dict["coins"] = ["BTC-USDT"]
    client = ReadOnlyExchange(instrument_row, ticker_row)
    client.balance = lambda: [{"details": [{"ccy": "USDT", "cashBal": "100", "availBal": "100"}, {"ccy": "TRY", "cashBal": "10", "availBal": "10"}]}]
    client.try_usdt_rate = lambda: "0.02"
    result = run_smoke(cfg_dict, client)
    assert result["portfolio"]["equity_usdt"] == "100.2"
    assert result["portfolio"]["cash_usdt"] == "100"
    assert result["portfolio"]["positions"][0]["value_usdt"] == "0.2"
    assert result["order"]["order_status"] == "simulated"
