"""T-007: LLM sadece riski azaltabilir. Ağsız; sahte sağlayıcılar."""
import copy
import json
import time

import pytest

from grail_analyst import review, review_payload

CFG = {"min_order_usdt": "2", "max_order_usdt": "10", "llm_timeout_s": 2}


def dec(inst, action, size, **kw):
    d = {"cycle_id": 7, "agent": "GRAIL-01", "mode": "live", "dry_run": True, "inst_id": inst,
         "action": action, "size_usdt": size, "ref_price": "100", "target_weight_pct": 10.0,
         "reason": "trend +1.0%", "decided_at_ms": 1760700000000}
    d.update(kw)
    return d


DECISIONS = [dec("BTC-USDT", "BUY", "10"), dec("ETH-USDT", "SELL", "6"), dec("SOL-USDT", "HOLD", "0")]
SNAP = {"cycle_id": 7, "at_ms": 1760700000000, "closes": {"BTC-USDT": [100, 101, 102]}}
NEWS = [{"title": "ETF inflows strong", "source": "x"}]


def fake(reviews):
    """Verilen review listesini JSON metin olarak döndüren sahte sağlayıcı; aldığı prompt'u kaydeder."""
    def provider(prompt, timeout_s):
        provider.prompts.append(prompt)
        return json.dumps({"reviews": reviews})
    provider.prompts = []
    return provider


def by_inst(out):
    return {d["inst_id"]: d for d in out}


def test_no_provider_passes_through_skipped():
    out = review(DECISIONS, SNAP, NEWS, CFG, provider=None)
    assert len(out) == 3
    for o, d in zip(out, DECISIONS):
        assert o["action"] == d["action"] and o["size_usdt"] == d["size_usdt"]
        assert o["llm_flag"] == "skipped"
        assert o["llm_note"] == "skipped: no_provider"
        assert {k: v for k, v in o.items() if not k.startswith("llm_")} == d


def test_input_not_mutated():
    before = copy.deepcopy(DECISIONS)
    review(DECISIONS, SNAP, NEWS, CFG, provider=fake([{"inst_id": "BTC-USDT", "action": "HOLD", "note": "no"}]))
    assert DECISIONS == before


def test_bad_json_passes_through():
    out = review(DECISIONS, SNAP, NEWS, CFG, provider=lambda p, t: "not json {")
    assert [o["llm_flag"] for o in out] == ["skipped"] * 3
    assert all(o["llm_note"] == "skipped: bad_json" for o in out)
    assert [(o["action"], o["size_usdt"]) for o in out] == [("BUY", "10"), ("SELL", "6"), ("HOLD", "0")]


@pytest.mark.parametrize("raw", ["[]", '{"reviews": "x"}', "null", '{"reviews": [1, 2]}'])
def test_schema_invalid_passes_through(raw):
    out = review(DECISIONS, SNAP, NEWS, CFG, provider=lambda p, t: raw)
    assert [(o["action"], o["size_usdt"]) for o in out] == [("BUY", "10"), ("SELL", "6"), ("HOLD", "0")]
    assert all(o["llm_flag"] == "skipped" for o in out)


def test_provider_exception_passes_through():
    def boom(p, t):
        raise RuntimeError("HTTP 429 key=SECRET")
    out = review(DECISIONS, SNAP, NEWS, CFG, provider=boom)
    assert all(o["llm_flag"] == "skipped" and o["llm_note"] == "skipped: provider_error" for o in out)
    assert "SECRET" not in json.dumps(out)


def test_timeout_does_not_block():
    def slow(p, t):
        time.sleep(3)
        return json.dumps({"reviews": []})
    t0 = time.monotonic()
    out = review(DECISIONS, SNAP, NEWS, {**CFG, "llm_timeout_s": 0.2}, provider=slow)
    assert time.monotonic() - t0 < 1.5
    assert all(o["llm_note"] == "skipped: timeout" for o in out)
    assert [(o["action"], o["size_usdt"]) for o in out] == [("BUY", "10"), ("SELL", "6"), ("HOLD", "0")]


def test_timeout_capped_at_8s():
    seen = []
    def p(prompt, timeout_s):
        seen.append(timeout_s)
        return '{"reviews": []}'
    review(DECISIONS, SNAP, NEWS, {"llm_timeout_s": 60}, provider=p)
    assert seen == [8.0]


def test_larger_size_is_clamped():
    out = by_inst(review(DECISIONS, SNAP, NEWS, CFG, provider=fake([
        {"inst_id": "BTC-USDT", "action": "BUY", "size_usdt": "50", "note": "go big"},
        {"inst_id": "ETH-USDT", "action": "SELL", "size_usdt": 999, "note": "dump"},
    ])))
    assert (out["BTC-USDT"]["action"], out["BTC-USDT"]["size_usdt"]) == ("BUY", "10")
    assert (out["ETH-USDT"]["action"], out["ETH-USDT"]["size_usdt"]) == ("SELL", "6")
    assert out["BTC-USDT"]["llm_flag"] == "approved"
    assert "clamp" in out["BTC-USDT"]["llm_note"]


def test_direction_flip_becomes_hold():
    out = by_inst(review(DECISIONS, SNAP, NEWS, CFG, provider=fake([
        {"inst_id": "BTC-USDT", "action": "SELL", "size_usdt": "10", "note": "bearish"},
        {"inst_id": "ETH-USDT", "action": "BUY", "size_usdt": "6", "note": "bullish"},
    ])))
    for inst in ("BTC-USDT", "ETH-USDT"):
        assert out[inst]["action"] == "HOLD" and out[inst]["size_usdt"] == "0"
        assert out[inst]["llm_flag"] == "vetoed"


def test_hold_cannot_become_order():
    out = by_inst(review(DECISIONS, SNAP, NEWS, CFG, provider=fake([
        {"inst_id": "SOL-USDT", "action": "BUY", "size_usdt": "10", "note": "moon"},
    ])))
    assert (out["SOL-USDT"]["action"], out["SOL-USDT"]["size_usdt"]) == ("HOLD", "0")
    assert out["SOL-USDT"]["llm_flag"] == "approved"


def test_unknown_coin_ignored():
    out = review(DECISIONS, SNAP, NEWS, CFG, provider=fake([
        {"inst_id": "DOGE-USDT", "action": "BUY", "size_usdt": "10", "note": "x"},
    ]))
    assert [o["inst_id"] for o in out] == ["BTC-USDT", "ETH-USDT", "SOL-USDT"]
    assert all(o["llm_flag"] == "skipped" for o in out)


def test_veto_and_reduce():
    out = by_inst(review(DECISIONS, SNAP, NEWS, CFG, provider=fake([
        {"inst_id": "BTC-USDT", "action": "HOLD", "note": "headline risk"},
        {"inst_id": "ETH-USDT", "action": "SELL", "size_usdt": "3.456", "note": "partial"},
        {"inst_id": "SOL-USDT", "action": "HOLD", "note": "agree"},
    ])))
    assert (out["BTC-USDT"]["action"], out["BTC-USDT"]["size_usdt"], out["BTC-USDT"]["llm_flag"]) == ("HOLD", "0", "vetoed")
    assert out["BTC-USDT"]["llm_note"] == "headline risk"
    assert (out["ETH-USDT"]["action"], out["ETH-USDT"]["size_usdt"], out["ETH-USDT"]["llm_flag"]) == ("SELL", "3.45", "reduced")
    assert out["SOL-USDT"]["llm_flag"] == "approved"


def test_reduce_below_min_order_becomes_hold():
    out = by_inst(review(DECISIONS, SNAP, NEWS, CFG, provider=fake([
        {"inst_id": "BTC-USDT", "action": "BUY", "size_usdt": "1.5", "note": "small"},
    ])))
    assert (out["BTC-USDT"]["action"], out["BTC-USDT"]["size_usdt"], out["BTC-USDT"]["llm_flag"]) == ("HOLD", "0", "vetoed")


@pytest.mark.parametrize("bad", [{"inst_id": "BTC-USDT", "action": "YOLO", "note": "x"},
                                 {"inst_id": "BTC-USDT", "action": "BUY", "size_usdt": "-5", "note": "x"},
                                 {"inst_id": "BTC-USDT", "action": "BUY", "size_usdt": "NaN", "note": "x"},
                                 {"inst_id": "BTC-USDT", "action": "BUY", "size_usdt": True, "note": "x"}])
def test_malformed_item_passes_through(bad):
    out = by_inst(review(DECISIONS, SNAP, NEWS, CFG, provider=fake([bad])))
    assert (out["BTC-USDT"]["action"], out["BTC-USDT"]["size_usdt"], out["BTC-USDT"]["llm_flag"]) == ("BUY", "10", "skipped")


def test_missing_size_means_approve():
    out = by_inst(review(DECISIONS, SNAP, NEWS, CFG, provider=fake([{"inst_id": "BTC-USDT", "action": "BUY", "note": "ok"}])))
    assert (out["BTC-USDT"]["action"], out["BTC-USDT"]["size_usdt"], out["BTC-USDT"]["llm_flag"]) == ("BUY", "10", "approved")


def test_note_is_ascii_short_and_clean():
    note = "Çok riskli\n haber: ğüşıöç " + "x" * 500 + "\x00"
    out = by_inst(review(DECISIONS, SNAP, NEWS, CFG, provider=fake([{"inst_id": "BTC-USDT", "action": "HOLD", "note": note}])))
    n = out["BTC-USDT"]["llm_note"]
    assert n.isascii() and len(n) <= 160 and "\n" not in n and "\x00" not in n
    assert n.startswith("Cok riskli haber: gusioc")


def test_fenced_json_accepted():
    raw = "```json\n" + json.dumps({"reviews": [{"inst_id": "BTC-USDT", "action": "HOLD", "note": "n"}]}) + "\n```"
    out = by_inst(review(DECISIONS, SNAP, NEWS, CFG, provider=lambda p, t: raw))
    assert out["BTC-USDT"]["llm_flag"] == "vetoed"


def test_prompt_contains_decisions_and_news():
    p = fake([])
    review(DECISIONS, SNAP, NEWS, CFG, provider=p)
    assert len(p.prompts) == 1
    assert "BTC-USDT" in p.prompts[0] and "ETF inflows strong" in p.prompts[0]


def test_all_hold_skips_llm_call():
    p = fake([])
    holds = [dec("BTC-USDT", "HOLD", "0"), dec("ETH-USDT", "HOLD", "0")]
    out = review(holds, SNAP, NEWS, CFG, provider=p)
    assert p.prompts == []
    assert all(o["llm_flag"] == "skipped" and o["llm_note"] == "skipped: no_orders" for o in out)


def test_garbage_inputs_never_raise():
    assert review(None, None, None, None, provider=fake([])) == []
    out = review([dec("BTC-USDT", "BUY", "10"), "junk"], "x", "y", "z", provider=fake([]))
    assert out[0]["action"] == "BUY" and out[1] == "junk"


def test_review_payload_replaces_decisions_and_is_hash_ready():
    payload = {"cycle_id": 7, "agent": "GRAIL-01", "mode": "live", "dry_run": True,
               "decided_at_ms": 1760700000000, "decisions": copy.deepcopy(DECISIONS)}
    out = review_payload(payload, SNAP, NEWS, CFG, provider=fake([{"inst_id": "BTC-USDT", "action": "HOLD", "note": "no"}]))
    assert payload["decisions"][0]["action"] == "BUY"  # girdi değişmez
    assert {k: v for k, v in out.items() if k != "decisions"} == {k: v for k, v in payload.items() if k != "decisions"}
    assert by_inst(out["decisions"])["BTC-USDT"]["action"] == "HOLD"
    json.dumps(out, sort_keys=True, separators=(",", ":"), ensure_ascii=True)  # kanonik JSON'a girer
    assert review_payload(None, SNAP, NEWS, CFG) is None


def test_with_real_engine_payload():
    """engine.decide payload'ı → review_payload: BUY'lar veto edilir, BUY/SELL sayısı artmaz."""
    ge = pytest.importorskip("grail_engine")
    import numpy as np
    from pathlib import Path
    cfg = json.loads((Path(__file__).resolve().parents[2] / "contracts" / "config.example.json").read_text(encoding="utf-8"))
    rng = np.random.default_rng(3)
    closes = {c: [float(x) for x in 100 * np.exp(np.cumsum(0.002 + 0.01 * rng.standard_normal(49)))] for c in cfg["coins"]}
    res = ge.decide({"cycle_id": 1, "at_ms": 1760700000000, "closes": closes},
                    {"equity_usdt": "100", "cash_usdt": "100", "positions": []}, cfg)
    payload = res["payload"]
    orders = [d for d in payload["decisions"] if d["action"] != "HOLD"]
    assert orders, "fixture en az bir emir uretmeli"
    veto_all = fake([{"inst_id": d["inst_id"], "action": "SELL", "size_usdt": "999", "note": "risk off"} for d in orders])
    out = review_payload(payload, {"closes": closes}, [], cfg, provider=veto_all)
    assert all(d["action"] == "HOLD" and d["llm_flag"] in ("vetoed", "skipped") for d in out["decisions"])
    assert [d["inst_id"] for d in out["decisions"]] == [d["inst_id"] for d in payload["decisions"]]
