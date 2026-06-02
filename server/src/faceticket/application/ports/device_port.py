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

# 팔찌 LED 명령 화이트리스트 — ESP32(NFC 보드)가 ESP-NOW 로 팔찌에 브로드캐스트하는 RGB 명령.
# 펌웨어(esp32-pn5180-smoke)가 실제 구현한 단색 4종만 허용. 임의 시리얼 주입 방지용.
LED_COMMANDS = frozenset({"RGB R", "RGB G", "RGB B", "RGB OFF"})

# 서버 측 LED 패턴 — 펌웨어는 단색만 알기에, 서버가 프리미티브(RGB R/G/B/OFF)를 시간차로
# 연속 전송해 패턴을 "재생"한다. 각 패턴은 (명령, 지속초) 프레임의 무한 반복 시퀀스.
# 밝기 단계가 없어 BREATHE 는 on/off 펄스로 근사한다.
LED_PATTERNS = {
    "PATTERN RAINBOW": [("RGB R", 0.5), ("RGB G", 0.5), ("RGB B", 0.5)],
    "PATTERN BLINK":   [("RGB R", 0.4), ("RGB OFF", 0.4)],
    "PATTERN BREATHE": [("RGB B", 0.8), ("RGB OFF", 0.8)],
    "PATTERN STROBE":  [("RGB R", 0.07), ("RGB OFF", 0.07)],
}


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
    # 태그가 RF 필드에 들어올 때까지 WAKE 를 폴링. NFC_NO_TAG 는 재시도, 그 외 오류는 즉시 실패.
    async def wake_wristband_wait(self, *, timeout_s: float = 5.0) -> bool: ...
    async def signal_pass(self) -> bool: ...
    async def signal_deny(self) -> bool: ...
    async def clear_wristband(self) -> bool: ...

    # 팔찌 LED — NFC(ESP32) 보드로 RGB 명령 라인 전송 (ESP-NOW 브로드캐스트).
    async def set_led(self, command: str) -> bool: ...
