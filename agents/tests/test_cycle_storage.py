import json

import pytest

from grail_agents.config import GrailError
from grail_agents.payload import canonical_payload, commitment
from grail_agents.storage import CycleStore
from grail_agents.chain import SimulatedChain


def test_ethereum_keccak_vector_not_sha3():
    # Keccak-256 of empty bytes (Ethereum reference vector).
    from eth_hash.auto import keccak
    assert keccak(b"").hex() == "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"


def test_canonical_payload_sorts_decisions_and_all_keys_and_escapes_ascii():
    payload = {"z": "ı", "decisions": [{"inst_id": "ETH-USDT", "llm_note": "reduce", "llm_flag": "reduced"}, {"inst_id": "BTC-USDT"}]}
    assert canonical_payload(payload) == '{"decisions":[{"inst_id":"BTC-USDT"},{"inst_id":"ETH-USDT","llm_flag":"reduced","llm_note":"reduce"}],"z":"\\u0131"}'
    assert payload["decisions"][0]["inst_id"] == "ETH-USDT"
    salted = commitment(canonical_payload(payload), "0x" + "00" * 32)
    assert salted.startswith("0x") and len(salted) == 66
    changed = {**payload, "z": "other"}
    assert commitment(canonical_payload(changed), "0x" + "00" * 32) != salted


@pytest.mark.parametrize("salt", ["0x01", "00" * 32, "0x" + "gg" * 32])
def test_salt_must_be_32_hex_bytes(salt):
    with pytest.raises(GrailError):
        commitment("{}", salt)


def test_cycle_ids_and_peak_are_persistent(tmp_path):
    store = CycleStore(tmp_path)
    with store.lock():
        assert store.allocate_cycle() == 1
        assert store.update_peak("100") == "100"
        assert store.update_peak("95") == "100"
    reopened = CycleStore(tmp_path)
    with reopened.lock():
        assert reopened.allocate_cycle() == 2
        assert reopened.update_peak("101") == "101"


def test_pending_write_and_remove_are_atomic_json(tmp_path):
    store = CycleStore(tmp_path)
    record = {"cycle_id": 1, "payload_utf8": "{}", "salt_hex": "0x" + "01" * 32}
    store.save_pending(record)
    assert store.pending() == [record]
    assert json.loads((tmp_path / "pending/1.json").read_text()) == record
    assert list((tmp_path / "pending").glob("*.tmp")) == []
    store.remove_pending(1)
    assert store.pending() == []


def test_simulated_chain_hash_checks_and_does_not_pretend_real_identity():
    chain = SimulatedChain()
    salt = "0x" + "01" * 32
    digest = commitment("{}", salt)
    tx = chain.commit(1, digest)
    assert tx.startswith("simulated:")
    assert chain.lookup(1)["commit_hash"] == digest
    with pytest.raises(GrailError):
        chain.commit(1, digest)
    with pytest.raises(GrailError):
        chain.reveal(1, "changed", salt, "none")
    chain.reveal(1, "{}", salt, "none")
    assert chain.lookup(1)["revealed"] is True
    with pytest.raises(GrailError):
        chain.reveal(1, "{}", salt, "none")
    info = chain.info()
    assert info["simulated"] is True and info["agent_id"] is None
    assert info["commits"] == info["reveals"] == 1


def test_same_runtime_has_one_writer(tmp_path):
    with CycleStore(tmp_path).lock():
        with pytest.raises(GrailError, match="RUNTIME_LOCK"):
            with CycleStore(tmp_path).lock():
                pass


def test_deployed_chain_test_vector_when_available():
    from pathlib import Path
    path = Path(__file__).parents[2] / "contracts/chain.json"
    if not path.exists():
        pytest.skip("T-003 chain.json is not available; deployment vector pending")
    vector = json.loads(path.read_text(encoding="utf-8"))["testVector"]
    assert commitment(vector["payloadUtf8"], vector["saltHex"]) == vector["commitHash"]
