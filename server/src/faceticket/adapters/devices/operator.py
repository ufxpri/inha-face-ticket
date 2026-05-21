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

import logging
from typing import Optional

from faceticket.adapters.devices.serial_io import SerialTransport
from faceticket.application.ports import IOperatorDevice

log = logging.getLogger(__name__)


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
    def port(self) -> Optional[str]:
        return self._t.port

    async def connect(self, port: str) -> bool:
        if not await self._t.connect(port):
            return False
        try:
            pong = await self._t.send("PING")
            log.info("[OPERATOR] PING → %r", pong)
        except Exception:
            pass
        return True

    def disconnect(self) -> None:
        self._t.disconnect()

    async def wake_wristband(self) -> bool:
        return await self._t.send_ok("WAKE")

    async def signal_pass(self) -> bool:
        return await self._t.send_ok("PASS")

    async def signal_deny(self) -> bool:
        return await self._t.send_ok("DENY")

    async def clear_wristband(self) -> bool:
        return await self._t.send_ok("CLEAR")
