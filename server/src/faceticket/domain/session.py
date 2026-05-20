"""진행 중인 발급/입장/반납 절차의 상태 — 순수 데이터.

단일 운영자 모델 (한 번에 하나의 절차만). 변경은 새 인스턴스를 반환하는 식이 아니라
명시적으로 mutable 하게 다룬다 — `FlowRunner` 안에서만 변형되므로 안전.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from faceticket.domain.embedding import Embedding
from faceticket.domain.states import Flow


@dataclass
class Session:
    flow: Optional[Flow] = None
    seat: str = ""
    name: str = ""
    embedding: Optional[Embedding] = field(default=None, repr=False)

    @property
    def busy(self) -> bool:
        return self.flow is not None

    def start(self, flow: Flow, *, seat: str = "", name: str = "") -> None:
        self.flow = flow
        self.seat = seat
        self.name = name
        self.embedding = None

    def reset(self) -> None:
        self.flow = None
        self.seat = ""
        self.name = ""
        self.embedding = None
