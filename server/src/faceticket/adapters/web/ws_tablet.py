"""/ws/tablet 엔드포인트 — 이미지 업로드 → 얼굴 추출 → flow_runner 통보."""
from __future__ import annotations

import base64
import datetime as _dt
import logging

from fastapi import WebSocket, WebSocketDisconnect

from faceticket.adapters.web import ws_protocol as wp
from faceticket.adapters.web.client_pool import ClientPool
from faceticket.application.flow_runner import FlowRunner
from faceticket.application.ports import IFaceRecognizer, IPresenter
from faceticket.application.toggle_service import ToggleService
from faceticket.config import COSINE_THRESHOLD

log = logging.getLogger(__name__)


class TabletWebSocketHandler:
    def __init__(
        self,
        *,
        tablets: ClientPool,
        face: IFaceRecognizer,
        flow_runner: FlowRunner,
        presenter: IPresenter,
        toggles: ToggleService,
    ) -> None:
        self.tablets = tablets
        self.face = face
        self.flow = flow_runner
        self.presenter = presenter
        self.toggles = toggles

    async def __call__(self, ws: WebSocket) -> None:
        await ws.accept()
        self.tablets.add(ws)
        try:
            await ws.send_json(wp.msg_hello("tablet", cosine_threshold=COSINE_THRESHOLD))
            await self.toggles.broadcast_flags()
            while True:
                data = await ws.receive_json()
                await self._handle(data)
        except WebSocketDisconnect:
            pass
        except Exception:
            log.exception("/ws/tablet")
        finally:
            self.tablets.remove(ws)
            await self.toggles.broadcast_flags()

    async def _handle(self, data: dict) -> None:
        if data.get("type") != "image":
            return

        img_b64 = data.get("data", "")
        if "," in img_b64:
            img_b64 = img_b64.split(",", 1)[1]
        try:
            img_bytes = base64.b64decode(img_b64)
        except Exception:
            await self.presenter.emit_capture_result(False, "이미지 디코드 실패")
            return

        result = await self.face.extract(img_bytes)
        if not result.ok or result.embedding is None:
            msg = result.reason or "얼굴 미검출 — 다시 시도"
            await self.presenter.emit_capture_result(False, msg)
            await self.presenter.emit_log(f"캡처 거부: {msg}", "warn")
            return

        await self.presenter.emit_capture_result(True, "인식 완료", result.embedding)
        await self.presenter.emit_embedding_snapshot(
            result.embedding, _dt.datetime.now().strftime("%H:%M:%S")
        )
        await self.flow.face_captured(result.embedding)
