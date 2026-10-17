"""T-012: 30 günlük geriye oynatma (replay) — saf engine tarafı + I/O script'i (ağsız, sahte okx çalıştırıcı)."""
import json
import math
import re
import tempfile
from pathlib import Path

import pytest

from conftest import make_closes
from grail_engine.replay import align_closes, count_cash_moves, max_drawdown_pct, replay, summary_text

H = 3_600_000
T0 = 1_790_000_000_000 - (1_790_000_000_000 % H)


def rows(closes, start_ms=T0, confirm_last=True):
    """Kapanışlardan OKX ham satırları (en yeni önce, OKX gibi)."""
    out = [[str(start_ms + i * H), str(c), str(c), str(c), str(c), "1", "1", "1", "1"] for i, c in enumerate(closes)]
    if not confirm_last:
        out[-1][8] = "0"
    return list(reversed(out))


def market(cfg, n=200, drift=0.001, vol=0.002):
    return {c: rows(make_closes(n=n, drift=drift, vol=vol, seed=i + 1)) for i, c in enumerate(sorted(cfg["coins"]))}


# --- yardımcılar ---
def test_max_drawdown_is_worst_peak_to_trough_pct():
    assert max_drawdown_pct([100, 120, 90, 130, 117]) == pytest.approx(25.0)


def test_max_drawdown_zero_when_never_falls():
    assert max_drawdown_pct([1, 2, 3]) == 0.0


def test_count_cash_moves_counts_invested_to_cash_transitions():
    # 10 → 1 nakit (1), 6 → 0 nakit (2); başlangıçtaki 0 sayılmaz
    assert count_cash_moves([0, 5, 10, 1, 0, 6, 0], threshold=2) == 2


def test_align_closes_keeps_confirmed_bars_common_to_all_coins():
    a = [[str(T0 + i * H), "1", "1", "1", str(10 + i), "1", "1", "1", "0" if i == 3 else "1"] for i in range(4)]
    b = [[str(T0 + i * H), "1", "1", "1", str(20 + i), "1", "1", "1", "1"] for i in (0, 2, 3)]
    ts, closes = align_closes({"A-USDT": list(reversed(a)), "B-USDT": b})
    assert ts == [T0, T0 + 2 * H]
    assert closes == {"A-USDT": [10.0, 12.0], "B-USDT": [20.0, 22.0]}


# --- replay ---
def test_buy_and_hold_splits_capital_equally_and_pays_fee(cfg):
    coins = sorted(cfg["coins"])
    up = [100.0] * 48 + [100.0 + 100.0 * i / 99 for i in range(100)]  # pencere başı 100 → son 200
    data = {c: rows(up if c == coins[0] else [50.0] * 148) for c in coins}
    res = replay(data, cfg, capital_usdt=100, fee_pct=0.1, window_bars=100)
    # 20 USDT/coin, %0.1 ücret: 19.98 × 2 + 4 × 19.98
    assert res["buy_hold"]["final_usdt"] == pytest.approx(119.88, abs=1e-3)
    assert res["series"][0]["buy_hold_usdt"] == pytest.approx(99.9, abs=1e-3)


def test_window_is_last_n_bars_after_warmup(cfg):
    res = replay(market(cfg, n=300), cfg, window_bars=100)
    assert len(res["series"]) == 100
    assert res["window"]["bars"] == 100 and res["window"]["warmup_bars"] == cfg["lookback_bars"]
    assert res["series"][0]["t_ms"] == T0 + 200 * H + H  # bar kapanış zamanı
    assert res["series"][-1]["t_ms"] == T0 + 299 * H + H


def test_not_enough_bars_raises(cfg):
    with pytest.raises(ValueError):
        replay(market(cfg, n=40), cfg)


def test_uptrend_buys_within_config_limits(cfg):
    res = replay(market(cfg, n=200, drift=0.002), cfg, window_bars=150)
    g = res["grail"]
    assert g["orders"]["buy"] > 0
    assert 0 < g["orders"]["largest_usdt"] <= float(cfg["max_order_usdt"])
    assert all(0.0 <= p["grail_cash_pct"] <= 100.0 for p in res["series"])
    assert res["series"][-1]["grail_cash_pct"] < 50.0  # yükselişte büyük ölçüde yatırımda
    assert res["assumptions"]["capital_usdt"] == float(cfg["max_total_deploy_usdt"])
    assert res["assumptions"]["orders_sent"] == 0


def test_downturn_moves_portfolio_to_cash(cfg):
    cfg["kill_switch_drawdown_pct"] = 50  # sadece trend çıkışını test et (kill switch ayrı testte)
    data = {c: rows(make_closes(n=150, drift=0.003, vol=0.002, seed=i + 1)
                    + make_closes(n=150, drift=-0.005, vol=0.002, seed=i + 11,
                                  start=make_closes(n=150, drift=0.003, vol=0.002, seed=i + 1)[-1]))
            for i, c in enumerate(sorted(cfg["coins"]))}
    res = replay(data, cfg, window_bars=250)
    assert res["grail"]["times_went_to_cash"] >= 1
    # engine min_order altındaki kırıntıyı satmaz → "tam nakit" = coin değeri < min_order_usdt
    last = res["series"][-1]
    assert last["grail_usdt"] * (100 - last["grail_cash_pct"]) / 100 < float(cfg["min_order_usdt"])
    assert res["grail"]["orders"]["sell"] > 0


def test_kill_switch_freezes_trading_after_drawdown(cfg):
    coins = sorted(cfg["coins"])
    data = {}
    for i, c in enumerate(coins):
        up = make_closes(n=120, drift=0.003, vol=0.002, seed=i + 1)
        crash = [up[-1] * 0.7] * 2 + [up[-1] * 0.7 * (1 + 0.001 * k) for k in range(1, 40)]
        data[c] = rows(up + crash)
    res = replay(data, cfg, window_bars=110)
    assert res["grail"]["kill_switch_bars"] > 0
    assert res["grail"]["max_drawdown_pct"] >= cfg["kill_switch_drawdown_pct"]


def test_avg_independent_bets_is_mean_of_engine_n_eff(cfg):
    res = replay(market(cfg, n=200), cfg, window_bars=100)
    per_bar = [p["independent_bets"] for p in res["series"] if p["independent_bets"] is not None]
    assert len(per_bar) == 100 and all(x > 0 for x in per_bar)
    assert res["grail"]["avg_independent_bets"] == pytest.approx(sum(per_bar) / len(per_bar), abs=0.01)


def test_replay_is_deterministic_and_json_safe(cfg):
    data = market(cfg, n=200)
    a, b = replay(data, cfg, window_bars=100), replay(data, cfg, window_bars=100)
    assert a == b
    json.dumps(a, allow_nan=False)
    assert {"series", "grail", "buy_hold", "window", "assumptions"} <= set(a)
    for k in ("final_usdt", "return_pct", "max_drawdown_pct"):
        assert isinstance(a["grail"][k], float) and isinstance(a["buy_hold"][k], float)


def test_summary_is_three_plain_english_sentences(cfg):
    res = replay(market(cfg, n=200), cfg, window_bars=100)
    text = summary_text(res)
    assert text.isascii()
    body = [ln for ln in text.strip().splitlines() if ln and not ln.startswith("#")]
    sentences = re.split(r"(?<=[.!?])\s+", " ".join(body).strip())
    assert len(sentences) == 3
    assert f"{res['grail']['final_usdt']:.2f}" in text and f"{res['buy_hold']['final_usdt']:.2f}" in text
    assert "independent bets" in text


# --- I/O script'i (scripts/replay_okx.py) ---
def fake_okx(all_rows):
    """`okx market candles` taklidi: --after'dan eski satırlar, en yeni önce, --limit kadar."""
    calls = []

    def run(args):
        calls.append(args)
        after = int(args[args.index("--after") + 1]) if "--after" in args else math.inf
        limit = int(args[args.index("--limit") + 1])
        return [r for r in all_rows if int(r[0]) < after][:limit]

    return run, calls


def test_fetch_candles_pages_back_with_after_and_drops_open_bar():
    from replay_okx import fetch_candles

    data = rows([float(i + 1) for i in range(700)], confirm_last=False)
    run, calls = fake_okx(data)
    got = fetch_candles("BTC-USDT", "1H", need=500, run=run)
    assert len(got) == 500
    ts = [int(r[0]) for r in got]
    assert ts == sorted(ts) and len(set(ts)) == 500
    assert ts[-1] == T0 + 698 * H  # açık (confirm=0) son bar yok
    assert all(a[:3] == ["market", "candles", "BTC-USDT"] for a in calls)
    assert "--after" in calls[1]


def test_fetch_candles_stops_when_history_runs_out():
    from replay_okx import fetch_candles

    run, calls = fake_okx(rows([1.0 + i for i in range(50)]))
    got = fetch_candles("BTC-USDT", "1H", need=500, run=run)
    assert len(got) == 50 and len(calls) <= 3


@pytest.fixture
def tmp_dir():
    """tmp_path yerine: bu makinede pytest-of-<kullanıcı> klasörünün izni bozuk (WinError 5)."""
    with tempfile.TemporaryDirectory() as d:
        yield Path(d)


def test_run_replay_writes_json_and_summary(cfg, tmp_dir):
    from replay_okx import run_replay

    tmp_path = tmp_dir

    data_path = tmp_path / "candles.json"
    data_path.write_text(json.dumps({"bar": "1H", "fetched_at_ms": T0, "source": "test", "candles": market(cfg, n=200)}))
    out = run_replay(data_path, tmp_path / "out", cfg, window_bars=100)
    res = json.loads((tmp_path / "out" / "replay.json").read_text(encoding="utf-8"))
    md = (tmp_path / "out" / "replay-summary.md").read_text(encoding="utf-8")
    assert res["window"]["bars"] == 100 and res["source"]["fetched_at_ms"] == T0
    assert md == summary_text(res) and out["grail"] == res["grail"]
