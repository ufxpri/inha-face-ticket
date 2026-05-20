"""IPresenter — application 이 UI 로 상태를 내보내는 단방향 포트.

이전의 `flow.admins.broadcast({...})` 처럼 도메인이 wire format 을 직접 만드는 일을 끊는다.
flows/services 는 `presenter.emit_state(...)` 만 호출하고, wire 직렬화는 `WebSocketPresenter`
어댑터에서 한 곳에서만 한다.
"""
from __future__ import annotations

from typing import Any, Literal, Optional, Protocol, runtime_checkable

from faceticket.domain.embedding import Embedding
from faceticket.domain.states import Flow, FlowState

LogLevel = Literal["info", "warn", "error"]


@runtime_checkable
class IPresenter(Protocol):
    async def emit_state(self, state: FlowState, **extra: Any) -> None: ...
    async def emit_log(self, msg: str, level: LogLevel = "info") -> None: ...

    async def request_capture(self, flow: Flow, *, seat: str = "") -> None: ...
    async def emit_capture_result(
        self, ok: bool, msg: str, embedding: Optional[Embedding] = None
    ) -> None: ...

    async def emit_embedding_snapshot(
        self, embedding: Embedding, captured_at: str
    ) -> None: ...

    async def emit_complete(self, ok: bool, msg: str, **extra: Any) -> None: ...

    async def emit_active_list(self, items: list[dict]) -> None: ...
    async def emit_flags(self, snapshot: dict) -> None: ...
