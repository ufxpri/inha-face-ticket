"""발급 플로우 — 얼굴 캡처 → 팔찌 태그 → BLE write → DB 기록."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

from faceticket.application.flows._base import FlowBase
from faceticket.application.ports import IIssueRepository
from faceticket.config import LED_ISSUED
from faceticket.domain.embedding import Embedding
from faceticket.domain.errors import MissingEmbeddingError
from faceticket.domain.states import Flow, FlowState

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class IssueOutcome:
    ok: bool
    wristband_id: str = ""
    seat: str = ""
    issue_id: int = 0
    reason: Optional[str] = None


class IssueFlow(FlowBase):
    """발급 플로우. 외부 진입점은 `start` / `on_face_captured` / `on_tag`."""

    def __init__(self, *, repo: IIssueRepository, **kw) -> None:
        super().__init__(**kw)
        self.repo = repo

    # ── 시작 ──────────────────────────────────────────────────
    async def start(self, seat: str, name: str) -> None:
        self.require_device()                          # raises MissingDeviceError
        self.session.start(Flow.ISSUE, seat=seat, name=name)
        await self.presenter.emit_log(
            f"① 발급 세션 시작 — 좌석 {seat}, 이름 {name or '(미지정)'}"
        )
        await self.presenter.emit_state(FlowState.AWAIT_FACE)
        await self.presenter.request_capture(Flow.ISSUE, seat=seat)
        await self.presenter.emit_log("② 태블릿에 얼굴 캡처 트리거 송신 (WebSocket)")

    # ── 얼굴 캡처 콜백 ────────────────────────────────────────
    async def on_face_captured(self, embedding: Embedding) -> None:
        self.session.embedding = embedding
        await self.presenter.emit_log(
            "③ 얼굴 임베딩 추출 완료. 팔찌를 NFC 리더에 태그하세요."
        )
        await self.presenter.emit_state(FlowState.AWAIT_TAG)

    # ── 팔찌 태그 (운영자 클릭) ───────────────────────────────
    async def on_tag(self) -> IssueOutcome:
        if self.session.embedding is None:
            raise MissingEmbeddingError("얼굴 임베딩이 없습니다.")

        dev = self.require_device()
        await self.presenter.emit_log("④ 운영자 장치에 wake 명령 전송 (Serial)")
        if not await dev.wake_wristband():
            return IssueOutcome(False, reason="wake 실패 — 장치 상태를 확인하세요.")

        await self.presenter.emit_log("⑤ 팔찌 BLE 광고 대기 후 Central 연결 시도")
        async with self.ble_session() as connected:
            if not connected:
                return IssueOutcome(False, reason="BLE 연결 실패")

            await self.presenter.emit_log("⑥ 임베딩 / 좌석 정보 write (BLE GATT)")
            if not await self.ble.write_embedding(self.session.embedding):
                return IssueOutcome(False, reason="임베딩 write 실패")
            await self.ble.write_seat(self.session.seat)

            wid = await self.ble.read_wristband_id()
            issue_id = self.repo.record_issue(wid, self.session.seat, self.session.name)
            await self.presenter.emit_log(
                f"⑦ SQLite 기록 — issue#{issue_id} 팔찌 {wid} → 좌석 {self.session.seat}"
            )
            await self.ble.write_led_effect(LED_ISSUED)

        await self.presenter.emit_log("⑧ 발급 완료 — BLE 연결 해제")
        return IssueOutcome(True, wristband_id=wid, seat=self.session.seat, issue_id=issue_id)
