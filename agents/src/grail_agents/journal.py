"""Durable, atomically claimed client IDs. Contains order intent, never secrets."""
from contextlib import contextmanager
import json
from pathlib import Path
import sqlite3

from .config import GrailError


class OrderJournal:
    def __init__(self, path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        try:
            with sqlite3.connect(self.path) as connection:
                connection.execute("CREATE TABLE IF NOT EXISTS orders (client_id TEXT PRIMARY KEY, record TEXT NOT NULL)")
        except sqlite3.Error:
            raise GrailError("JOURNAL_IO: cannot initialize durable order journal") from None

    @contextmanager
    def transaction(self):
        try:
            with sqlite3.connect(self.path, timeout=5) as connection:
                connection.execute("BEGIN IMMEDIATE")
                yield _Session(connection)
        except sqlite3.Error:
            raise GrailError("JOURNAL_IO: cannot lock or persist order journal") from None

    def get(self, client_id):
        with self.transaction() as session:
            return session.get(client_id)

    def records(self):
        with self.transaction() as session:
            return session.records()

    def save_result(self, client_id, result):
        with self.transaction() as session:
            record = session.get(client_id)
            if record is None:
                raise GrailError("JOURNAL_MISSING: order intent was not recorded")
            record["result"] = result
            session.save(client_id, record)


class _Session:
    def __init__(self, connection):
        self.connection = connection

    def get(self, client_id):
        row = self.connection.execute("SELECT record FROM orders WHERE client_id = ?", (client_id,)).fetchone()
        try:
            return json.loads(row[0]) if row else None
        except (TypeError, ValueError):
            raise GrailError("JOURNAL_CORRUPT: invalid order record") from None

    def records(self):
        try:
            return [json.loads(row[0]) for row in self.connection.execute("SELECT record FROM orders")]
        except (TypeError, ValueError):
            raise GrailError("JOURNAL_CORRUPT: invalid order record") from None

    def save(self, client_id, record):
        self.connection.execute("INSERT INTO orders(client_id, record) VALUES (?, ?) ON CONFLICT(client_id) DO UPDATE SET record=excluded.record", (client_id, json.dumps(record, sort_keys=True, separators=(",", ":"))))
