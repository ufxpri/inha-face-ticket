"""발급장치 — NFC 라이터 + 게이트 솔레노이드를 제어하는 Arduino UNO.

프로토콜 (arduino_uno.ino 와 일치)
    NFC_WRITE BLE_TRIGGER   → OK
    NFC_CLEAR               → OK
    GATE OPEN               → OK PASS (또는 통과 미감지)
    GATE DENY               → OK
"""
from __future__ import annotations

from typing import Optional

from faceticket.adapters.devices.serial_io import SerialTransport
from faceticket.application.ports import IOperatorDevice


def _sim_response(cmd: str) -> str:
    if cmd.startswith("GATE OPEN"):
        return "OK PASS"
    return "OK"


class IssuanceDevice(IOperatorDevice):
    def __init__(self, baud: int = 115200) -> None:
        self._t = SerialTransport("ISSUANCE", baud=baud, sim_response=_sim_response, sim_latency=0.2)

    @property
    def is_connected(self) -> bool:
        return self._t.is_connected

    @property
    def port(self) -> Optional[str]:
        return self._t.port

    async def connect(self, port: str) -> bool:
        return await self._t.connect(port)

    def disconnect(self) -> None:
        self._t.disconnect()

    async def wake_wristband(self) -> bool:
        return await self._t.send_ok("NFC_WRITE BLE_TRIGGER")

    async def signal_pass(self) -> bool:
        return await self._t.send_ok("GATE OPEN", expected="OK PASS")

    async def signal_deny(self) -> bool:
        return await self._t.send_ok("GATE DENY")

    async def clear_wristband(self) -> bool:
        return await self._t.send_ok("NFC_CLEAR")
