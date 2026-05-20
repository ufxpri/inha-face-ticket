"""입장장치 — ESP32-C3 팔찌 USB-CDC 직결.

프로토콜 (firmware/wristband/src/main.cpp 와 일치)
    WAKE  → OK
    PASS  → OK
    DENY  → OK
    CLEAR → OK
    PING  → OK PONG

NFC 트리거 없음(이미 BLE 광고 중). signal_pass 는 LED SUCCESS + OLED 표시.
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


class EntryDevice(IOperatorDevice):
    def __init__(self, baud: int = 115200) -> None:
        self._t = SerialTransport("ENTRY", baud=baud, sim_response=_sim_response, sim_latency=0.1)

    @property
    def is_connected(self) -> bool:
        return self._t.is_connected

    @property
    def port(self) -> Optional[str]:
        return self._t.port

    async def connect(self, port: str) -> bool:
        if not await self._t.connect(port):
            return False
        # PING 으로 응답 확인 (펌웨어 부팅 직후엔 빈 줄일 수 있음)
        try:
            pong = await self._t.send("PING")
            log.info("[ENTRY] PING → %r", pong)
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
