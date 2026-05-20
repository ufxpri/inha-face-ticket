"""팔찌(ESP32-C3) BLE Central — Strategy 패턴.

구조
    BLEBackend         추상 인터페이스 (ABC)
    MockBLEBackend     팔찌 펌웨어 없이 메모리 상의 가짜 상태로 동작
    RealBLEBackend     bleak BLE Central 실제 동작
    BLEClient          얇은 facade — `mock` 속성 토글로 backend 교체.
                       메서드 호출은 __getattr__ 로 현재 backend 에 위임.
"""
from __future__ import annotations

import asyncio
import uuid
from abc import ABC, abstractmethod
from typing import Optional

import numpy as np

try:
    from bleak import BleakClient, BleakScanner
    HAS_BLE = True
except Exception:
    HAS_BLE = False

from app.config import (
    BLE_MOCK,
    WRISTBAND_NAME,
    CHR_EMBEDDING, CHR_SEAT, CHR_FLAG, CHR_LED, CHR_ID,
    CHR_EMB_OFF, EMBED_CHUNK,
    EMBED_DIM,
)


# ── ABC ──────────────────────────────────────────────────────
class BLEBackend(ABC):
    @abstractmethod
    async def connect_wristband(self, timeout: float) -> bool: ...
    @abstractmethod
    async def disconnect(self) -> None: ...
    @abstractmethod
    async def write_embedding(self, embedding: np.ndarray) -> bool: ...
    @abstractmethod
    async def write_seat(self, seat: str) -> bool: ...
    @abstractmethod
    async def read_embedding(self) -> Optional[np.ndarray]: ...
    @abstractmethod
    async def read_contact_flag(self) -> bool: ...
    @abstractmethod
    async def read_wristband_id(self) -> str: ...
    @abstractmethod
    async def write_led_effect(self, code: int) -> bool: ...

    async def clear_wristband(self) -> bool:
        """반납 — 임베딩과 좌석을 초기화. 두 backend 공통 구현."""
        ok1 = await self.write_embedding(np.zeros(EMBED_DIM, dtype=np.float32))
        ok2 = await self.write_seat("")
        return ok1 and ok2


# ── Mock backend ─────────────────────────────────────────────
class MockBLEBackend(BLEBackend):
    """메모리 상에 가짜 팔찌 상태를 보관. 연결/쓰기/읽기 모두 즉시 성공."""

    def __init__(self) -> None:
        self._state: Optional[dict] = None

    def _ensure_state(self) -> dict:
        if self._state is None:
            self._state = {
                "id": "MOCK-" + uuid.uuid4().hex[:8].upper(),
                "embedding": np.zeros(EMBED_DIM, dtype=np.float32),
                "seat": "",
                "flag": False,
            }
        return self._state

    async def connect_wristband(self, timeout: float) -> bool:
        await asyncio.sleep(0.3)
        self._ensure_state()
        print("[BLE-MOCK] 팔찌 연결 시뮬레이트")
        return True

    async def disconnect(self) -> None:
        return None

    async def write_embedding(self, embedding: np.ndarray) -> bool:
        data = np.asarray(embedding, dtype=np.float32).tobytes()
        self._ensure_state()["embedding"] = np.frombuffer(data, dtype=np.float32).copy()
        print(f"[BLE-MOCK] 임베딩 write ({len(data)}B)")
        return True

    async def write_seat(self, seat: str) -> bool:
        self._ensure_state()["seat"] = seat
        print(f"[BLE-MOCK] 좌석 write: {seat}")
        return True

    async def read_embedding(self) -> Optional[np.ndarray]:
        return self._ensure_state()["embedding"].copy()

    async def read_contact_flag(self) -> bool:
        return self._ensure_state()["flag"]

    async def read_wristband_id(self) -> str:
        return self._ensure_state()["id"]

    async def write_led_effect(self, code: int) -> bool:
        print(f"[BLE-MOCK] LED 효과 코드 {code:#04x}")
        return True

    async def clear_wristband(self) -> bool:
        ok = await super().clear_wristband()
        if self._state is not None:
            self._state["flag"] = False
        return ok


# ── Real backend ─────────────────────────────────────────────
class RealBLEBackend(BLEBackend):
    """bleak Central. 광고 검색 → GATT read/write."""

    def __init__(self) -> None:
        self.client: "BleakClient | None" = None

    async def connect_wristband(self, timeout: float) -> bool:
        device = await BleakScanner.find_device_by_name(WRISTBAND_NAME, timeout=timeout)
        if device is None:
            print(f"[BLE] '{WRISTBAND_NAME}' 광고를 찾지 못함")
            return False
        self.client = BleakClient(device)
        try:
            await self.client.connect()
            ok = self.client.is_connected
            print(f"[BLE] 연결 결과: {ok}")
            return ok
        except Exception as e:
            print(f"[BLE] 연결 실패: {e}")
            return False

    async def disconnect(self) -> None:
        if self.client and self.client.is_connected:
            try: await self.client.disconnect()
            except Exception as e: print(f"[BLE] 해제 오류: {e}")

    async def write_embedding(self, embedding: np.ndarray) -> bool:
        # 청킹: BLE 단일 attribute write 한계(512B)를 우회. payload=[u16_le offset][data]
        data = np.asarray(embedding, dtype=np.float32).tobytes()
        try:
            for off in range(0, len(data), EMBED_CHUNK):
                chunk = data[off:off + EMBED_CHUNK]
                payload = off.to_bytes(2, "little") + chunk
                await self.client.write_gatt_char(CHR_EMBEDDING, payload, response=True)
            return True
        except Exception as e:
            print(f"[BLE] 임베딩 write 실패: {e}")
            return False

    async def write_seat(self, seat: str) -> bool:
        try:
            await self.client.write_gatt_char(CHR_SEAT, str(seat).encode("utf-8"), response=True)
            return True
        except Exception as e:
            print(f"[BLE] 좌석 write 실패: {e}")
            return False

    async def read_embedding(self) -> Optional[np.ndarray]:
        # 청킹 read: CHR_EMB_OFF 에 시작 오프셋을 쓰고 CHR_EMBEDDING 을 읽으면 그 위치부터 EMBED_CHUNK 바이트 반환
        total = EMBED_DIM * 4
        buf = bytearray(total)
        try:
            for off in range(0, total, EMBED_CHUNK):
                await self.client.write_gatt_char(CHR_EMB_OFF, off.to_bytes(2, "little"), response=True)
                chunk = await self.client.read_gatt_char(CHR_EMBEDDING)
                end = min(off + len(chunk), total)
                buf[off:end] = chunk[:end - off]
            return np.frombuffer(bytes(buf), dtype=np.float32).copy()
        except Exception as e:
            print(f"[BLE] 임베딩 read 실패: {e}")
            return None

    async def read_contact_flag(self) -> bool:
        try:
            data = await self.client.read_gatt_char(CHR_FLAG)
            return bool(data and data[0])
        except Exception as e:
            print(f"[BLE] 체결 플래그 read 실패: {e}")
            return False

    async def read_wristband_id(self) -> str:
        try:
            data = await self.client.read_gatt_char(CHR_ID)
            return data.decode("utf-8", errors="replace")
        except Exception as e:
            print(f"[BLE] 팔찌 ID read 실패: {e}")
            return ""

    async def write_led_effect(self, code: int) -> bool:
        try:
            await self.client.write_gatt_char(CHR_LED, bytes([code & 0xFF]), response=False)
            return True
        except Exception as e:
            print(f"[BLE] LED write 실패: {e}")
            return False


# ── Facade ───────────────────────────────────────────────────
class BLEClient:
    """Backend 를 hot-swap 하는 얇은 facade.

    `client.mock = True/False` 로 런타임 전환. 메서드 호출은 __getattr__ 로
    현재 backend 에 위임된다. real backend 가 사용 불가(bleak 미설치)인 경우
    `real_available` 가 False 이고 mock=False 로 토글이 거부된다.
    """

    def __init__(self, mock: Optional[bool] = None) -> None:
        if mock is None:
            mock = BLE_MOCK or not HAS_BLE
        self._real: Optional[RealBLEBackend] = RealBLEBackend() if HAS_BLE else None
        self._mock_backend = MockBLEBackend()
        self._mock = bool(mock) or self._real is None
        self._backend: BLEBackend = self._mock_backend if self._mock else self._real
        self._log_init()

    def _log_init(self) -> None:
        if not HAS_BLE:
            print("[BLE] bleak 미설치 — MOCK")
        else:
            print(f"[BLE] backend = {'MOCK' if self._mock else 'REAL'}"
                  + (" (config.BLE_MOCK=True)" if BLE_MOCK and self._mock else ""))

    @property
    def mock(self) -> bool:
        return self._mock

    @mock.setter
    def mock(self, value: bool) -> None:
        new_mock = bool(value)
        if new_mock == self._mock:
            return
        if not new_mock and self._real is None:
            print("[BLE] real backend 사용 불가 — MOCK 유지")
            return
        self._mock = new_mock
        self._backend = self._mock_backend if new_mock else self._real
        print(f"[BLE] backend → {'MOCK' if new_mock else 'REAL'}")

    @property
    def real_available(self) -> bool:
        return self._real is not None

    def __getattr__(self, name: str):
        # __init__ 이전이나 _backend 부재 시 무한 재귀 방지
        if name.startswith("_") or name in ("mock", "real_available"):
            raise AttributeError(name)
        return getattr(object.__getattribute__(self, "_backend"), name)
