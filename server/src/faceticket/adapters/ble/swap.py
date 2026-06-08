"""BleSwap — Mock/Real backend 를 hot-swap 하는 명시적 holder. `IBleCentral` 자체도 구현한다.

기존 `BLEClient.__getattr__` 매직 위임을 없애고 명시적 메서드 forwarding 으로 대체. 호출 측
코드(flows, services)는 `IBleCentral` 만 알고 swap 이라는 단어를 보지 못한다 — toggle 만
이 객체의 set_mock 을 호출한다. IDE 자동완성과 타입체커가 모든 호출을 본다.
"""
from __future__ import annotations

import logging
from typing import Optional

from faceticket.application.ports import IBleCentral
from faceticket.adapters.ble.mock_central import MockBleCentral
from faceticket.config import Settings
from faceticket.domain.embedding import Embedding

log = logging.getLogger(__name__)


def _try_import_bleak() -> bool:
    try:
        import bleak  # noqa: F401
        return True
    except Exception:
        return False


HAS_BLEAK = _try_import_bleak()


class BleSwap(IBleCentral):
    """현재 backend 로 매 호출을 forward. set_mock 으로 backend 교체."""

    def __init__(self, *, prefer_mock: bool = True) -> None:
        self._mock_backend: IBleCentral = MockBleCentral()
        self._real_backend: Optional[IBleCentral] = None
        if HAS_BLEAK:
            from faceticket.adapters.ble.bleak_central import BleakBleCentral
            try:
                self._real_backend = BleakBleCentral()
            except Exception as e:
                log.info("bleak 로드 실패(%s) — MOCK 강제", e)
                self._real_backend = None

        self._is_mock: bool = bool(prefer_mock) or self._real_backend is None
        self._log_init()

    def _log_init(self) -> None:
        if not HAS_BLEAK:
            log.info("bleak 미설치 — MOCK")
        else:
            log.info("backend = %s", "MOCK" if self._is_mock else "REAL")

    # ── 토글 상태 ────────────────────────────────────────────
    @property
    def is_mock(self) -> bool:
        return self._is_mock

    @property
    def real_available(self) -> bool:
        return self._real_backend is not None

    def set_mock(self, mock: bool) -> bool:
        """real 불가인데 mock=False 요청 시 거부하고 False 반환."""
        new_mock = bool(mock)
        if new_mock == self._is_mock:
            return True
        if not new_mock and self._real_backend is None:
            return False
        self._is_mock = new_mock
        log.info("backend → %s", "MOCK" if new_mock else "REAL")
        return True

    # ── IBleCentral 명시적 forwarding ────────────────────────
    @property
    def _current(self) -> IBleCentral:
        if self._is_mock or self._real_backend is None:
            return self._mock_backend
        return self._real_backend

    async def connect_wristband(self, timeout: float = 15.0, address: Optional[str] = None) -> bool:
        return await self._current.connect_wristband(timeout=timeout, address=address)

    async def disconnect(self) -> None:
        await self._current.disconnect()

    async def write_embedding(self, embedding: Embedding) -> bool:
        return await self._current.write_embedding(embedding)

    async def read_embedding(self) -> Optional[Embedding]:
        return await self._current.read_embedding()

    async def write_seat(self, seat: str) -> bool:
        return await self._current.write_seat(seat)

    async def read_contact_flag(self) -> bool:
        return await self._current.read_contact_flag()

    async def read_wristband_id(self) -> str:
        return await self._current.read_wristband_id()

    async def write_led_effect(self, code: int) -> bool:
        return await self._current.write_led_effect(code)

    async def clear_wristband(self) -> bool:
        return await self._current.clear_wristband()


def make_ble_swap(settings: Settings) -> BleSwap:
    return BleSwap(prefer_mock=settings.ble_mock)
