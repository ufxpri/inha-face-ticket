"""발급 세션 SQLite 저장소.

좌석 ↔ 팔찌 ID 매핑은 발급 시스템에만 영구 저장된다.
입장 시스템은 팔찌 내부 임베딩만으로 판정하므로 DB가 필요 없다.
"""
from __future__ import annotations

import datetime
import sqlite3
import threading
from pathlib import Path
from typing import Optional


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


class IssueDB:
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

    def find_active_by_wristband(self, wristband_id: str) -> Optional[dict]:
        with self.lock:
            cur = self.conn.execute(
                "SELECT id, wristband_id, seat, name, issued_at "
                "FROM issues WHERE wristband_id = ? AND returned_at IS NULL",
                (wristband_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            return dict(zip(["id","wristband_id","seat","name","issued_at"], row))

    def close(self) -> None:
        with self.lock:
            self.conn.close()
