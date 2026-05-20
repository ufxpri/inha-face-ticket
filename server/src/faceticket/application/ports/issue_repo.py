"""발급 세션 영속화 포트."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Protocol, runtime_checkable


@dataclass(frozen=True)
class IssueRecord:
    id: int
    wristband_id: str
    seat: str
    name: str
    issued_at: str


@runtime_checkable
class IIssueRepository(Protocol):
    def record_issue(self, wristband_id: str, seat: str, name: str = "") -> int: ...
    def record_return(self, wristband_id: str) -> bool: ...
    def list_active(self) -> list[dict]: ...
    def find_active_by_wristband(self, wristband_id: str) -> Optional[IssueRecord]: ...
    def close(self) -> None: ...
