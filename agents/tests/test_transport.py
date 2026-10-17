import json
import subprocess

import pytest

from grail_agents.atk import AtkClient
from grail_agents.config import GrailError, OrderRejected


class Runner:
    def __init__(self, output=None, error=None):
        self.output = output
        self.error = error
        self.calls = []

    def __call__(self, argv, **kwargs):
        self.calls.append((argv, kwargs))
        if self.error:
            raise self.error
        return subprocess.CompletedProcess(argv, 0, json.dumps(self.output), "")


def test_ticker_uses_fixed_tr_profile_and_json(ticker_row):
    run = Runner([ticker_row])
    client = AtkClient(command=("okx",), runner=run)
    assert client.ticker("BTC-USDT") == ticker_row
    argv, kwargs = run.calls[0]
    assert argv == ["okx", "--profile", "grail", "--site", "tr", "--live", "--json", "market", "ticker", "BTC-USDT"]
    assert kwargs["shell"] is False and kwargs["timeout"] > 0


def test_api_error_envelope_never_looks_like_success():
    client = AtkClient(command=("okx",), runner=Runner({"code": "50111", "msg": "secret-key-value", "data": []}))
    with pytest.raises(GrailError, match="ATK_API_50111") as caught:
        client.balance()
    assert "secret-key-value" not in str(caught.value)


def test_nonzero_exit_is_redacted():
    def run(argv, **kwargs):
        return subprocess.CompletedProcess(argv, 1, "secret", "secret-key-value")
    with pytest.raises(GrailError, match="ATK_CLI") as caught:
        AtkClient(command=("okx",), runner=run).balance()
    assert "secret" not in str(caught.value)


def test_timeout_is_not_retried():
    run = Runner(error=subprocess.TimeoutExpired("okx", 1, output="secret"))
    with pytest.raises(GrailError, match="ATK_TIMEOUT"):
        AtkClient(command=("okx",), runner=run).balance()
    assert len(run.calls) == 1


def test_unknown_read_command_blocked_before_process():
    run = Runner([])
    with pytest.raises(GrailError, match="ALLOWLIST"):
        AtkClient(command=("okx",), runner=run)._read("account", "transfer")
    assert run.calls == []


def test_order_state_mapping():
    for raw, expected in [("live", "pending"), ("partially_filled", "partial"), ("filled", "filled"), ("canceled", "canceled"), ("mmp_canceled", "canceled"), ("novel_state", "unknown")]:
        client = AtkClient(command=("okx",), runner=Runner([{"state": raw, "ordId": "42", "clOrdId": "grail1", "avgPx": "60000", "instId": "BTC-USDT"}]))
        assert client.order_status("BTC-USDT", "grail1")["order_status"] == expected


def test_environment_cannot_override_credentials_or_tr_host(ticker_row, monkeypatch):
    monkeypatch.setenv("OKX_API_KEY", "do-not-use")
    monkeypatch.setenv("OKX_API_BASE_URL", "https://www.okx.com")
    run = Runner([ticker_row])
    AtkClient(command=("okx",), runner=run).ticker("BTC-USDT")
    env = run.calls[0][1]["env"]
    assert "OKX_API_KEY" not in env
    assert env["OKX_API_BASE_URL"] == "https://tr.okx.com"


def test_spot_placement_uses_cash_and_quote_buy_budget():
    run = Runner([{"sCode": "0", "ordId": "42", "clOrdId": "g1"}])
    result = AtkClient(command=("okx",), runner=run)._place_spot({"inst_id": "BTC-USDT", "action": "BUY", "order_type": "market", "size": "5", "size_usdt": "5", "tgt_ccy": "quote_ccy", "client_order_id": "g1", "price": None})
    args = run.calls[0][0]
    assert args[args.index("--tdMode") + 1] == "cash"
    assert args[args.index("--tgtCcy") + 1] == "quote_ccy"
    assert args[args.index("--sz") + 1] == "5"
    assert "--banAmend" in args
    assert result["order_status"] == "pending" and result["okx_order_id"] == "42"


def test_try_valuation_uses_inverse_usdt_try_public_ticker():
    run = Runner([{"instId": "USDT-TRY", "last": "50"}])
    assert AtkClient(command=("okx",), runner=run).try_usdt_rate() == "0.02"
    assert run.calls[0][0][-3:] == ["market", "ticker", "USDT-TRY"]


def placement():
    return {"inst_id": "BTC-USDT", "action": "BUY", "order_type": "market", "size": "5", "size_usdt": "5", "tgt_ccy": "quote_ccy", "client_order_id": "g1", "price": None}


@pytest.mark.parametrize("wrapped,exit_code", [(False, 0), (True, 0), (True, 1)])
def test_explicit_structured_rejection_is_distinct(wrapped, exit_code):
    row = {"sCode": "51008", "sMsg": "secret", "ordId": "", "clOrdId": "g1"}
    data = {"code": "1", "data": [row]} if wrapped else [row]
    def run(argv, **kwargs):
        return subprocess.CompletedProcess(argv, exit_code, json.dumps(data), "secret")
    with pytest.raises(OrderRejected) as caught:
        AtkClient(command=("okx",), runner=run)._place_spot(placement())
    assert caught.value.code == "51008" and "secret" not in str(caught.value)


@pytest.mark.parametrize("data", [[None], [{"sCode": "garbage"}], {"code": "51008", "data": []}, [{"sCode": "51008", "ordId": "42"}]])
def test_unproven_rejection_remains_uncertain(data):
    with pytest.raises(GrailError) as caught:
        AtkClient(command=("okx",), runner=Runner(data))._place_spot(placement())
    assert not isinstance(caught.value, OrderRejected)
