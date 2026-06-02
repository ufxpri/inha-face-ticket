"""운영자 시리얼 장치 포트.

발급/입장 두 장치를 분리했던 구조에서 단일 OperatorDevice 로 통합했다가, NFC 리더와
입장 게이트가 서로 다른 보드/포트에 있는 현실에 맞춰 다시 역할(role)별 라우팅을 도입.
명령 시그니처는 동일하게 유지 (`wake_wristband / signal_pass / signal_deny / clear_wristband`).

  WAKE / CLEAR → NFC 역할  (ESP32 + PN5180)
  PASS / DENY  → GATE 역할 (Arduino UNO: 서보 + 초음파)

단일 보드(통합/SIM)는 `connect(port)` 로 두 역할을 같은 포트에 붙이고, 분리 운용은
`connect_role(role, port)` 로 역할별 포트를 따로 연결한다.
"""
from __future__ import annotations

from typing import Optional, Protocol, runtime_checkable

# 장치 역할 — 서버/프론트/펌웨어가 공유하는 문자열 키.
ROLE_NFC = "nfc"
ROLE_GATE = "gate"
ROLES = (ROLE_NFC, ROLE_GATE)


@runtime_checkable
class IOperatorDevice(Protocol):
    @property
    def is_connected(self) -> bool: ...
    @property
    def port(self) -> Optional[str]: ...

    async def connect(self, port: str) -> bool: ...
    def disconnect(self) -> None: ...

    # 역할별 라이프사이클 — 단일 장치는 role 을 무시하고 동일 포트로 동작.
    async def connect_role(self, role: str, port: str) -> bool: ...
    def disconnect_role(self, role: str) -> None: ...
    def status_snapshot(self) -> dict: ...

    async def wake_wristband(self) -> bool: ...
    async def signal_pass(self) -> bool: ...
    async def signal_deny(self) -> bool: ...
    async def clear_wristband(self) -> bool: ...
