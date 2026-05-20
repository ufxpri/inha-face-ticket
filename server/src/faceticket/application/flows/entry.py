"""입장 플로우 — 팔찌 태그 → BLE read → 얼굴 캡처 → 코사인 비교 → 게이트 OPEN/DENY."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

from faceticket.application.flows._base import FlowBase
from faceticket.config import COSINE_THRESHOLD, LED_FAILURE, LED_SUCCESS
from faceticket.domain.embedding import Embedding, cosine, is_zero_embedding
from faceticket.domain.states import Flow, FlowState

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class EntryTagResult:
    ok: bool
    reason: Optional[str] = None


@dataclass(frozen=True)
class EntryFaceResult:
    passed: bool
    similarity: float
    message: str


class EntryFlow(FlowBase):
    """입장 플로우. `start` → `on_tag` → `on_face_captured` 순으로 호출됨."""

    async def start(self) -> None:
        self.require_device()
        self.session.start(Flow.ENTRY)
        await self.presenter.emit_log("입장 절차 시작 — 팔찌를 게이트 리더에 태그하세요.")
        await self.presenter.emit_state(FlowState.AWAIT_TAG)

    async def on_tag(self) -> EntryTagResult:
        dev = self.require_device()

        await self.presenter.emit_log("① wake 명령 전송 (Serial)")
        if not await dev.wake_wristband():
            return EntryTagResult(False, "wake 실패")

        await self.presenter.emit_log("② BLE Central 연결 시도")
        if not await self.ble.connect_wristband(timeout=15.0):
            return EntryTagResult(False, "BLE 연결 실패")

        try:
            await self.presenter.emit_log("③ 팔찌 임베딩 / 체결 플래그 read")
            stored = await self.ble.read_embedding()
            flag_broken = await self.ble.read_contact_flag()

            if stored is None:
                return EntryTagResult(False, "임베딩 read 실패")

            if flag_broken:
                await self.ble.write_led_effect(LED_FAILURE)
                await dev.signal_deny()
                return EntryTagResult(False, "⚠ 체결 플래그 = 1 (중간 분리 감지) — 입장 거부")

            if is_zero_embedding(stored):
                await self.ble.write_led_effect(LED_FAILURE)
                return EntryTagResult(False, "⚠ 팔찌에 임베딩이 없습니다 (미발급)")

            self.session.embedding = stored
            await self.presenter.emit_log("④ 태블릿에 얼굴 캡처 트리거 송신")
            await self.presenter.emit_state(FlowState.AWAIT_FACE_ENTRY)
            await self.presenter.request_capture(Flow.ENTRY)
            return EntryTagResult(True)
        except Exception as e:
            log.exception("entry on_tag")
            return EntryTagResult(False, f"entry 단계 오류: {e}")

    async def on_face_captured(self, live_embedding: Embedding) -> EntryFaceResult:
        """비교 → signal_pass/deny → LED → BLE disconnect."""
        if self.session.embedding is None:
            return EntryFaceResult(False, 0.0, "내부 상태 오류 — 저장 임베딩 없음")

        dev = self.devices.active   # None 일 수도 있음 (그 사이 disconnect)
        sim = cosine(self.session.embedding, live_embedding)
        await self.presenter.emit_log(
            f"⑤ 코사인 유사도 = {sim:.4f} (임곗값 {COSINE_THRESHOLD})"
        )

        try:
            if sim >= COSINE_THRESHOLD:
                await self.presenter.emit_log("⑥ 통과 판정 — signal_pass")
                passed = bool(dev) and await dev.signal_pass()
                await self.ble.write_led_effect(LED_SUCCESS if passed else LED_FAILURE)
                msg = "통과" if passed else "게이트 통과 미감지"
                await self.presenter.emit_log(
                    "⑦ 통과 신호 확인" if passed else "⚠ 통과 감지 타임아웃",
                    "info" if passed else "warn",
                )
                return EntryFaceResult(passed, sim, msg)
            else:
                await self.presenter.emit_log("⑥ 거부 — signal_deny", "warn")
                if dev:
                    await dev.signal_deny()
                await self.ble.write_led_effect(LED_FAILURE)
                return EntryFaceResult(False, sim, "인증 실패")
        finally:
            await self._safe_ble_disconnect()
