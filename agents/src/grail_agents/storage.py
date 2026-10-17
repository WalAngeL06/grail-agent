"""Atomic cycle records and a crash-released, cross-process runtime lock."""
from contextlib import contextmanager
import json
import os
from pathlib import Path
import time
import uuid

from .config import GrailError, money, number


def atomic_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + "." + uuid.uuid4().hex + ".tmp")
    try:
        with temporary.open("x", encoding="utf-8", newline="\n") as handle:
            json.dump(value, handle, ensure_ascii=True, allow_nan=False, sort_keys=True, separators=(",", ":"))
            handle.flush()
            os.fsync(handle.fileno())
        try:
            os.replace(temporary, path)
        except PermissionError:
            # Windows readers/indexers can briefly deny replacement; retry only
            # this local atomic operation, never a chain/order submission.
            time.sleep(0.02)
            os.replace(temporary, path)
    except (OSError, TypeError, ValueError) as error:
        raise GrailError(f"STORAGE_WRITE: atomic runtime write failed ({type(error).__name__})") from None
    finally:
        temporary.unlink(missing_ok=True)


def read_json(path: Path, default=None):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return default
    except (OSError, ValueError):
        raise GrailError("STORAGE_READ: missing permissions or corrupt runtime JSON") from None


class CycleStore:
    def __init__(self, root):
        self.root = Path(root)
        self.pending_dir = self.root / "pending"
        self.pending_dir.mkdir(parents=True, exist_ok=True)

    @contextmanager
    def lock(self, name="agent.lock"):
        if name not in {"agent.lock", "runner.lock"}:
            raise GrailError("RUNTIME_LOCK: unsupported lock name")
        with (self.root / name).open("a+b") as handle:
            handle.seek(0, 2)
            if handle.tell() == 0:
                handle.write(b"0")
                handle.flush()
            handle.seek(0)
            try:
                if os.name == "nt":
                    import msvcrt
                    msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
                else:
                    import fcntl
                    fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            except OSError:
                raise GrailError("RUNTIME_LOCK: another agent owns this runtime") from None
            try:
                yield
            finally:
                handle.seek(0)
                if os.name == "nt":
                    msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
                else:
                    fcntl.flock(handle.fileno(), fcntl.LOCK_UN)

    def _control(self):
        value = read_json(self.root / "control.json", {})
        if not isinstance(value, dict):
            raise GrailError("STORAGE_CONTROL: invalid runtime control")
        return value

    def allocate_cycle(self):
        control = self._control()
        state = self.load_state() or {}
        recorded = [record["cycle_id"] for record in self.pending()]
        recorded.append(state.get("agent", {}).get("cycle_id", 0))
        cycle = max(control.get("next_cycle_id", 1), max(recorded, default=0) + 1)
        if type(cycle) is not int or not 1 <= cycle < 2**64:
            raise GrailError("STORAGE_CONTROL: cycle ID exhausted or invalid")
        atomic_json(self.root / "control.json", {**control, "next_cycle_id": cycle + 1})
        return cycle

    def update_peak(self, equity):
        control = self._control()
        peak = max(number(control.get("peak_equity_usdt", "0"), "peak"), number(equity, "equity"))
        atomic_json(self.root / "control.json", {**control, "peak_equity_usdt": money(peak)})
        return money(peak)

    def _pending_path(self, cycle_id):
        if type(cycle_id) is not int or not 1 <= cycle_id < 2**64:
            raise GrailError("STORAGE_CYCLE: invalid pending cycle ID")
        return self.pending_dir / f"{cycle_id}.json"

    def save_pending(self, record):
        atomic_json(self._pending_path(record["cycle_id"]), record)

    def pending(self):
        records = []
        for path in sorted(self.pending_dir.glob("*.json")):
            value = read_json(path)
            if not isinstance(value, dict) or self._pending_path(value.get("cycle_id")).name != path.name:
                raise GrailError("STORAGE_PENDING: invalid pending cycle record")
            records.append(value)
        return sorted(records, key=lambda record: record["cycle_id"])

    def remove_pending(self, cycle_id):
        self._pending_path(cycle_id).unlink(missing_ok=True)

    def load_state(self):
        return read_json(self.root / "state.json")

    def save_state(self, state):
        atomic_json(self.root / "state.json", state)
