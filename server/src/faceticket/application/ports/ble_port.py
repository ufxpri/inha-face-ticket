"""BLE Central 포트.

두 구현체:
    BleakBleCentral  — 실제 ESP32-C3 팔찌
    MockBleCentral   — 메모리상 가짜 상태

런타임 토글은 `BleSwap` (adapters/ble/swap.py) 가 들고 다닌다. `BleSwap` 자체가
`IBleCentral` 을 구현하며 현재 backend 로 매 호출을 명시적으로 forward 한다.
"""
from __future__ import annotations

from typing import Optional, Protocol, runtime_checkable

from faceticket.domain.embedding import Embedding


@runtime_checkable
class IBleCentral(Protocol):
    async def connect_wristband(self, timeout: float = 15.0, address: Optional[str] = None) -> bool: ...
    async def disconnect(self) -> None: ...

    async def write_embedding(self, embedding: Embedding) -> bool: ...
    async def read_embedding(self) -> Optional[Embedding]: ...

    async def write_seat(self, seat: str) -> bool: ...
    async def read_contact_flag(self) -> bool: ...
    async def read_wristband_id(self) -> str: ...

    async def write_led_effect(self, code: int) -> bool: ...
    async def clear_wristband(self) -> bool: ...
