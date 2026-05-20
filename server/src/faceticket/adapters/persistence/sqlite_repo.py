"""SQLite 구현체 — `IIssueRepository` 충족.

스키마는 기존과 동일 (구 `issue.db` 그대로 열린다).
"""
from __future__ import annotations

import datetime
import sqlite3
import threading
from pathlib import Path
from typing import Optional

from faceticket.application.ports import IIssueRepository, IssueRecord

SCHEMA = """
CREATE TABLE IF NOT EXISTS issues (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    wristband_id  TEXT    NOT NULL,
    seat          TEXT    NOT NULL,
    name          TEXT    DEFAULT '',
    issued_at     TEXT    NOT NULL,
    returned_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_active ON issues (returned_at);
"""


def _now() -> str:
    return datetime.datetime.now().isoformat(timespec="seconds")


class SqliteIssueRepository(IIssueRepository):
    def __init__(self, path: Path) -> None:
        self.conn = sqlite3.connect(str(path), check_same_thread=False)
        self.lock = threading.Lock()
        with self.lock:
            self.conn.executescript(SCHEMA)
            self.conn.commit()

    def record_issue(self, wristband_id: str, seat: str, name: str = "") -> int:
        with self.lock:
            cur = self.conn.execute(
                "INSERT INTO issues (wristband_id, seat, name, issued_at) VALUES (?, ?, ?, ?)",
                (wristband_id, seat, name, _now()),
            )
            self.conn.commit()
            return int(cur.lastrowid)

    def record_return(self, wristband_id: str) -> bool:
        with self.lock:
            cur = self.conn.execute(
                "UPDATE issues SET returned_at = ? "
                "WHERE wristband_id = ? AND returned_at IS NULL",
                (_now(), wristband_id),
            )
            self.conn.commit()
            return cur.rowcount > 0

    def list_active(self) -> list[dict]:
        with self.lock:
            cur = self.conn.execute(
                "SELECT id, wristband_id, seat, name, issued_at "
                "FROM issues WHERE returned_at IS NULL ORDER BY id DESC"
            )
            cols = ["id", "wristband_id", "seat", "name", "issued_at"]
            return [dict(zip(cols, r)) for r in cur.fetchall()]

    def find_active_by_wristband(self, wristband_id: str) -> Optional[IssueRecord]:
        with self.lock:
            cur = self.conn.execute(
                "SELECT id, wristband_id, seat, name, issued_at "
                "FROM issues WHERE wristband_id = ? AND returned_at IS NULL",
                (wristband_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            return IssueRecord(id=row[0], wristband_id=row[1], seat=row[2],
                               name=row[3], issued_at=row[4])

    def close(self) -> None:
        with self.lock:
            self.conn.close()
