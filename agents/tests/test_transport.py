import json
import subprocess

import pytest

from grail_agents.atk import AtkClient
from grail_agents.config import GrailError


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
