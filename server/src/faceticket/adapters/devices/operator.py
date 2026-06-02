"""OperatorDevice — 통합 운영자 장치.

기존 IssuanceDevice / EntryDevice 가 분리되어 있던 것을 단일 장치로 통합. 어떤 하드웨어가
연결되어 있든 (게이트 + NFC 가 있는 Arduino UNO, 또는 ESP32-C3 팔찌 USB-CDC 직결) 동일한
intent-oriented 명령 집합을 사용한다. 펌웨어가 자기 하드웨어에 맞춰 PASS = 게이트 OPEN,
DENY = 적색 LED 같은 식으로 implement.

통합 프로토콜
    WAKE  → OK          팔찌 BLE 광고 깨우기 (NFC 트리거 또는 noop)
    PASS  → OK          통과 신호 (게이트 OPEN / LED SUCCESS)
    DENY  → OK          거부 신호 (게이트 잠금 / LED FAILURE)
    CLEAR → OK          반납 후처리 (NFC 클리어 / 상태 초기화)
    PING  → OK PONG     헬스 체크
"""
from __future__ import annotations

import asyncio
import logging

from faceticket.adapters.devices.serial_io import SerialTransport
from faceticket.application.ports import ROLE_GATE, ROLE_NFC, IOperatorDevice

log = logging.getLogger(__name__)

PASS_RESPONSE_TIMEOUT_S = 7.0

# connect 직후 PING 핸드셰이크 — 보드가 auto-reset 리부트를 끝낼 때까지 짧은 PING 을 반복.
# 깨어나는 즉시 통과 → native USB 보드는 거의 즉시, 리셋되는 보드는 리부트만큼만 대기.
HANDSHAKE_ATTEMPTS = 8
HANDSHAKE_INTERVAL_S = 0.35
HANDSHAKE_PING_TIMEOUT_S = 0.6


def _sim_response(cmd: str) -> str:
    if cmd == "PING":
        return "OK PONG"
    return "OK"


class OperatorDevice(IOperatorDevice):
    """단일 운영자 장치. PING 으로 connect 직후 핸드셰이크 검증."""

    def __init__(self, baud: int = 115200) -> None:
        self._t = SerialTransport(
            "OPERATOR", baud=baud,
            sim_response=_sim_response, sim_latency=0.15,
        )

    @property
    def is_connected(self) -> bool:
        return self._t.is_connected

    @property
    def port(self) -> str | None:
        return self._t.port

    async def connect(self, port: str) -> bool:
        if not await self._t.connect(port):
            return False
        # 보드가 깨어날 때까지 PING 핸드셰이크 재시도. 깨어나면 그 즉시 반환.
        for attempt in range(1, HANDSHAKE_ATTEMPTS + 1):
            try:
                if await self._t.send_ok("PING", timeout_s=HANDSHAKE_PING_TIMEOUT_S):
                    log.info("[OPERATOR] PING 핸드셰이크 OK (시도 %d/%d)",
                             attempt, HANDSHAKE_ATTEMPTS)
                    return True
            except Exception:
                pass
            await asyncio.sleep(HANDSHAKE_INTERVAL_S)
        # 무응답이어도 연결은 유지 — PING 미구현 레거시 펌웨어 호환. 단 wake 실패 가능성 경고.
        log.warning("[OPERATOR] PING 핸드셰이크 무응답 — 연결 유지하나 보드 미응답 가능 "
                    "(펌웨어 PING 미구현이거나 리부트 지연)")
        return True

    def disconnect(self) -> None:
        self._t.disconnect()

    # ── 역할 인터페이스 (단일 장치는 role 무시) ──────────────
    async def connect_role(self, role: str, port: str) -> bool:
        return await self.connect(port)

    def disconnect_role(self, role: str) -> None:
        self.disconnect()

    def status_snapshot(self) -> dict:
        st = {"connected": self.is_connected, "port": self.port}
        return {ROLE_NFC: st, ROLE_GATE: st}

    async def wake_wristband(self) -> bool:
        return await self._t.send_ok("WAKE")

    async def signal_pass(self) -> bool:
        return await self._t.send_ok("PASS", timeout_s=PASS_RESPONSE_TIMEOUT_S)

    async def signal_deny(self) -> bool:
        return await self._t.send_ok("DENY")

    async def clear_wristband(self) -> bool:
        return await self._t.send_ok("CLEAR")
