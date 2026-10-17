"""Confirmed chain interface and explicit offline simulation (no RPC, keys or real tx)."""
from copy import deepcopy
from pathlib import Path
from typing import Protocol

from .config import GrailError
from .payload import commitment
from .storage import atomic_json, read_json


class ChainAdapter(Protocol):
    def next_cycle_id(self) -> int:
        """Largest confirmed own-agent cycle ID plus one, never commit count."""
        ...

    def lookup(self, cycle_id: int) -> dict | None:
        """Confirmed commitment/reveal; None = no confirmed entry, exception = unknown."""
        ...

    def commit(self, cycle_id: int, commit_hash: str) -> str:
        """Return only after successful confirmation; never auto-resend after timeout."""
        ...

    def reveal(self, cycle_id: int, payload_utf8: str, salt_hex: str, okx_order_id: str) -> str:
        """Return only after successful confirmation."""
        ...

    def info(self) -> dict:
        """state.chain metadata, verified identity and confirmed counters."""
        ...


class SimulatedChain:
    """Fake ledger; identifiers use simulated: prefix, identity/address are null."""
    def __init__(self, path=None):
        self.path = Path(path) if path is not None else None
        self.records = read_json(self.path, {}) if self.path else {}

    def _save(self):
        if self.path:
            atomic_json(self.path, self.records)

    def lookup(self, cycle_id):
        return deepcopy(self.records.get(str(cycle_id)))

    def next_cycle_id(self):
        return max((int(key) for key in self.records), default=0) + 1

    def commit(self, cycle_id, commit_hash):
        if str(cycle_id) in self.records:
            raise GrailError("CHAIN_DUPLICATE: cycle already committed")
        tx = f"simulated:commit:{cycle_id}"
        self.records[str(cycle_id)] = {"commit_hash": commit_hash, "commit_tx": tx, "revealed": False, "reveal_tx": None}
        self._save()
        return tx

    def reveal(self, cycle_id, payload_utf8, salt_hex, okx_order_id):
        record = self.records.get(str(cycle_id))
        if record is None or record["revealed"] or commitment(payload_utf8, salt_hex) != record["commit_hash"]:
            raise GrailError("CHAIN_REVEAL: missing, duplicate or mismatched commitment")
        tx = f"simulated:reveal:{cycle_id}"
        record.update({"revealed": True, "reveal_tx": tx, "payload_utf8": payload_utf8, "salt_hex": salt_hex, "okx_order_id": okx_order_id})
        self._save()
        return tx

    def info(self):
        commits = len(self.records)
        reveals = sum(record["revealed"] for record in self.records.values())
        return {"network": "simulated", "simulated": True, "chain_id": None, "address": None, "explorer": None, "agent_id": None, "identity_registry": None, "commits": commits, "reveals": reveals, "unrevealed": commits - reveals}
