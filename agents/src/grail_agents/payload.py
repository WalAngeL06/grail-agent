"""Exact bytes shared with GrailLedger: canonical JSON followed by 32 salt bytes."""
from copy import deepcopy
import json
import re

from eth_hash.auto import keccak

from .config import GrailError


def canonical_payload(payload: dict) -> str:
    try:
        value = deepcopy(payload)
        value["decisions"] = sorted(value["decisions"], key=lambda d: d["inst_id"])
        return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False)
    except (KeyError, TypeError, ValueError):
        raise GrailError("PAYLOAD_INVALID: cannot canonicalize final decisions") from None


def commitment(payload_utf8: str, salt_hex: str) -> str:
    if not isinstance(payload_utf8, str) or not isinstance(salt_hex, str) or not re.fullmatch(r"0x[0-9a-fA-F]{64}", salt_hex):
        raise GrailError("COMMITMENT_INVALID: UTF-8 payload and 32-byte hex salt required")
    return "0x" + keccak(payload_utf8.encode("utf-8") + bytes.fromhex(salt_hex[2:])).hex()


def client_order_id(agent: str, cycle_id: int, inst_id: str) -> str:
    if type(cycle_id) is not int or not 1 <= cycle_id < 2**64:
        raise GrailError("CYCLE_ID_INVALID: expected positive uint64")
    return f"g{cycle_id:x}x{keccak((agent + ':' + inst_id).encode()).hex()[:10]}"
