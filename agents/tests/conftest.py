import json
from pathlib import Path

import pytest


def pytest_configure(config):
    # Keep test data in the worktree; Windows' shared pytest temp has stale ACLs.
    (Path(config.rootpath) / "runtime").mkdir(exist_ok=True)


@pytest.fixture
def cfg_dict():
    return json.loads((Path(__file__).parents[2] / "contracts/config.example.json").read_text())


@pytest.fixture
def ticker_row():
    return {"instType": "SPOT", "instId": "BTC-USDT", "last": "60000", "open24h": "50000", "ts": "1000"}


@pytest.fixture
def instrument_row():
    return {"instType": "SPOT", "instId": "BTC-USDT", "baseCcy": "BTC", "quoteCcy": "USDT", "state": "live", "minSz": "0.00001", "lotSz": "0.00001", "tickSz": "0.1"}
