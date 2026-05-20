"""BLE Central 포트.

두 구현체:
    BleakBleCentral  — 실제 ESP32-C3 팔찌
    MockBleCentral   — 메모리상 가짜 상태

런타임 토글은 `BleSwap` (adapters/ble/factory.py) 가 들고 다닌다. 호출 측은
`container.ble.current.write_embedding(...)` 처럼 explicit 한 dispatch 를 쓴다.
"""
from __future__ import annotations

from typing import Optional, Protocol, runtime_checkable

from faceticket.domain.embedding import Embedding


@runtime_checkable
class IBleCentral(Protocol):
    async def connect_wristband(self, timeout: float = 15.0) -> bool: ...
    async def disconnect(self) -> None: ...

    async def write_embedding(self, embedding: Embedding) -> bool: ...
    async def read_embedding(self) -> Optional[Embedding]: ...

    async def write_seat(self, seat: str) -> bool: ...
    async def read_contact_flag(self) -> bool: ...
    async def read_wristband_id(self) -> str: ...

    async def write_led_effect(self, code: int) -> bool: ...
    async def clear_wristband(self) -> bool: ...
