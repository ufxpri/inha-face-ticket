"""WebSocketPresenter — IPresenter 구현체. application 이벤트를 wire dict 로 변환."""
from __future__ import annotations

from typing import Any, Optional

import numpy as np

from faceticket.adapters.web import ws_protocol as wp
from faceticket.adapters.web.client_pool import ClientPool
from faceticket.application.ports import IPresenter, LogLevel
from faceticket.domain.embedding import Embedding
from faceticket.domain.states import Flow, FlowState


def _to_list(emb: Embedding) -> list[float]:
    return np.asarray(emb, dtype=np.float32).ravel().tolist()


class WebSocketPresenter(IPresenter):
    """admin 풀과 tablet 풀을 들고 있는 단일 broadcaster."""

    def __init__(self, *, admins: ClientPool, tablets: ClientPool) -> None:
        self.admins = admins
        self.tablets = tablets

    # ── admin 방향 ───────────────────────────────────────────
    async def emit_state(self, state: FlowState, **extra: Any) -> None:
        await self.admins.broadcast(wp.msg_state(state, **extra))

    async def emit_log(self, msg: str, level: LogLevel = "info") -> None:
        await self.admins.broadcast(wp.msg_log(msg, level))

    async def emit_embedding_snapshot(self, embedding: Embedding, captured_at: str) -> None:
        await self.admins.broadcast(wp.msg_embedding_snapshot(_to_list(embedding), captured_at))

    async def emit_active_list(self, items: list[dict]) -> None:
        await self.admins.broadcast(wp.msg_active_list(items))

    async def emit_flags(self, snapshot: dict) -> None:
        await self.admins.broadcast(wp.msg_flags(snapshot))

    # ── tablet 방향 ──────────────────────────────────────────
    async def request_capture(self, flow: Flow, *, seat: str = "") -> None:
        await self.tablets.broadcast(wp.msg_capture_trigger(flow, seat=seat))

    async def emit_capture_result(
        self, ok: bool, msg: str, embedding: Optional[Embedding] = None
    ) -> None:
        emb_list = _to_list(embedding) if embedding is not None else None
        await self.tablets.broadcast(wp.msg_capture_result(ok, msg, emb_list))

    # ── 양쪽 모두 ────────────────────────────────────────────
    async def emit_complete(self, ok: bool, msg: str, **extra: Any) -> None:
        # 태블릿이 결과를 띄우려면 받아야 한다.
        await self.tablets.broadcast(wp.msg_complete(ok, msg, **extra))
