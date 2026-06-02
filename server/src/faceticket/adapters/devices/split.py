"""SplitOperatorDevice — NFC(ESP32) + Gate(UNO) 2-포트 합성 운영자 장치.

서버 플로우는 단일 `IOperatorDevice` 계약으로 돌지만, 물리적으로는 NFC 리더(ESP32+PN5180)와
입장 게이트(Arduino UNO: 서보+초음파)가 서로 다른 보드/시리얼 포트에 있다. 이 합성 장치가
명령을 역할별로 라우팅한다:

    WAKE / CLEAR  → NFC  역할
    PASS  / DENY  → GATE 역할
    PING          → 각 역할 connect 시 개별 핸드셰이크 (OperatorDevice 내부)

`is_connected` 는 **NFC 연결**을 기준으로 한다 — 발급/입장/반납 모든 플로우가 wake 로
시작하므로. 게이트는 입장 전용이라 미연결이어도 다른 플로우를 막지 않고, PASS/DENY 가
graceful 하게 실패(통과 미감지)할 뿐이다. UI 는 두 역할 상태를 따로 표시한다.
"""
from __future__ import annotations

import logging

from faceticket.adapters.devices.operator import OperatorDevice
from faceticket.application.ports import ROLE_GATE, ROLE_NFC, IOperatorDevice

log = logging.getLogger(__name__)


class SplitOperatorDevice(IOperatorDevice):
    """두 OperatorDevice 를 역할별로 라우팅하는 합성 장치."""

    def __init__(self, *, nfc: OperatorDevice, gate: OperatorDevice) -> None:
        self.nfc = nfc
        self.gate = gate

    def _role(self, role: str) -> OperatorDevice:
        if role == ROLE_NFC:
            return self.nfc
        if role == ROLE_GATE:
            return self.gate
        raise ValueError(f"알 수 없는 장치 역할: {role!r}")

    # ── 합성 상태 ────────────────────────────────────────────
    @property
    def is_connected(self) -> bool:
        # NFC 가 모든 플로우의 진입(wake) 조건 — 이를 '연결됨'의 기준으로 삼는다.
        return self.nfc.is_connected

    @property
    def port(self) -> str | None:
        return self.nfc.port

    def status_snapshot(self) -> dict:
        return {
            ROLE_NFC:  {"connected": self.nfc.is_connected,  "port": self.nfc.port},
            ROLE_GATE: {"connected": self.gate.is_connected, "port": self.gate.port},
        }

    # ── 역할별 라이프사이클 ──────────────────────────────────
    async def connect_role(self, role: str, port: str) -> bool:
        return await self._role(role).connect(port)

    def disconnect_role(self, role: str) -> None:
        self._role(role).disconnect()

    # 단일 connect — 두 역할을 같은 포트로 (통합 보드 / SIM 데모 폴백).
    # 실제 COM 은 같은 포트를 두 번 못 여니 SIM 전용에 가깝다.
    async def connect(self, port: str) -> bool:
        ok_nfc = await self.nfc.connect(port)
        ok_gate = await self.gate.connect(port)
        return ok_nfc and ok_gate

    def disconnect(self) -> None:
        self.nfc.disconnect()
        self.gate.disconnect()

    # ── 명령 라우팅 ──────────────────────────────────────────
    async def wake_wristband(self) -> bool:
        return await self.nfc.wake_wristband()

    async def clear_wristband(self) -> bool:
        return await self.nfc.clear_wristband()

    async def signal_pass(self) -> bool:
        return await self.gate.signal_pass()

    async def signal_deny(self) -> bool:
        return await self.gate.signal_deny()
