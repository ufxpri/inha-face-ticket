"""입장 플로우 — 팔찌 태그 → BLE read → 얼굴 캡처 → 코사인 비교 → 게이트 OPEN/DENY."""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass

from faceticket.application.flows._base import FlowBase
from faceticket.config import COSINE_THRESHOLD, LED_FAILURE, LED_SUCCESS
from faceticket.domain.embedding import Embedding, cosine, is_zero_embedding
from faceticket.domain.states import Flow, FlowState

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class EntryTagResult:
    ok: bool
    reason: str | None = None


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
        await self.presenter.emit_log("입장 절차 시작 — 팔찌 인식으로 자동 진입합니다.")
        await self.presenter.emit_state(FlowState.AWAIT_TAG)

    async def on_tag(self) -> EntryTagResult:
        dev = self.require_device()

        await self.presenter.emit_log("① 팔찌를 NFC 리더에 대주세요 — wake 대기 중 (최대 15초)")
        if not await dev.wake_wristband_wait():
            return EntryTagResult(False, "wake 실패")
        await self.presenter.emit_sound("tag")   # NFC 태그 인식 — 태블릿 '삑'

        await self.presenter.emit_log("② BLE Central 연결 시도")
        if not await self.ble.connect_wristband(timeout=15.0, address=dev.last_wristband_addr):
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
        finally:
            if self.session.embedding is None:
                await self._safe_ble_disconnect()

    async def on_face_captured(self, live_embedding: Embedding) -> EntryFaceResult:
        """비교 → signal_pass/deny → LED → BLE disconnect."""
        if self.session.embedding is None:
            return EntryFaceResult(False, 0.0, "내부 상태 오류 — 저장 임베딩 없음")

        dev = self.device if self.device.is_connected else None   # 그 사이 disconnect 가능
        sim = cosine(self.session.embedding, live_embedding)
        log.info("[FACE] 입장 코사인 유사도 = %.4f (임곗값 %.2f) → %s",
                 sim, COSINE_THRESHOLD, "통과" if sim >= COSINE_THRESHOLD else "거부")
        await self.presenter.emit_log(
            f"⑤ 코사인 유사도 = {sim:.4f} (임곗값 {COSINE_THRESHOLD})"
        )

        try:
            if sim >= COSINE_THRESHOLD:
                # 얼굴 인증 성공 → 즉시 '인식 완료'. 게이트 개방/통과 감지는 결과를 막지 않고
                # 백그라운드로 처리한다(사용자: 인식완료가 먼저 뜨고 그 다음 게이트를 통과).
                await self.ble.write_led_effect(LED_SUCCESS)
                await self.presenter.emit_log("⑥ 얼굴 인증 통과 — 게이트가 열립니다. 통과해 주세요")
                if dev:
                    asyncio.create_task(self._open_gate_and_confirm(dev))
                return EntryFaceResult(True, sim, "인증 통과")
            else:
                await self.presenter.emit_log("⑥ 거부 — signal_deny", "warn")
                if dev:
                    await dev.signal_deny()
                await self.ble.write_led_effect(LED_FAILURE)
                return EntryFaceResult(False, sim, "인증 실패")
        finally:
            await self._safe_ble_disconnect()

    async def _open_gate_and_confirm(self, dev) -> None:
        """게이트 개방 + 초음파 통과 확인 — 비차단. 인식완료를 먼저 알린 뒤 백그라운드로 실행.

        게이트가 없거나 통과가 늦어도 인증 결과(통과)에는 영향을 주지 않는다.
        """
        try:
            ok = await dev.signal_pass()
            await self.presenter.emit_log(
                "⑦ 게이트 통과 확인" if ok else "⑦ 게이트 미연결/통과 미감지 (인증은 통과)",
                "info" if ok else "warn",
            )
        except Exception as e:
            log.warning("게이트 개방 오류: %s", e)
