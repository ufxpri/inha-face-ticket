"""bleak BLE Central — 광고 검색 → GATT read/write + 청크 프로토콜.

`EMBED_DIM * 4 = 2048 B` > BLE 단일 attribute 한계(512 B) 이므로 청크. payload:
    write: [u16_le offset][data <= EMBED_CHUNK]
    read : write(CHR_EMB_OFF, offset) → read(CHR_EMBEDDING) 으로 256B 반환
"""
from __future__ import annotations

import logging
from typing import Optional

import numpy as np

from faceticket.application.ports import IBleCentral
from faceticket.config import (
    CHR_EMB_OFF, CHR_EMBEDDING, CHR_FLAG, CHR_ID, CHR_LED, CHR_SEAT,
    EMBED_CHUNK, EMBED_DIM, WRISTBAND_NAME,
)
from faceticket.domain.embedding import Embedding

log = logging.getLogger(__name__)


class BleakBleCentral(IBleCentral):
    def __init__(self) -> None:
        # bleak 는 import 시점에 시스템 BLE 스택을 건드릴 수 있어 lazy import
        from bleak import BleakClient  # noqa: F401
        self._BleakClient = None
        self._BleakScanner = None
        from bleak import BleakClient as _C, BleakScanner as _S
        self._BleakClient = _C
        self._BleakScanner = _S
        self.client = None

    async def connect_wristband(self, timeout: float = 15.0) -> bool:
        device = await self._BleakScanner.find_device_by_name(WRISTBAND_NAME, timeout=timeout)
        if device is None:
            log.warning("'%s' 광고를 찾지 못함", WRISTBAND_NAME)
            return False
        self.client = self._BleakClient(device)
        try:
            await self.client.connect()
            ok = self.client.is_connected
            log.info("연결 결과: %s", ok)
            return ok
        except Exception as e:
            log.warning("연결 실패: %s", e)
            return False

    async def disconnect(self) -> None:
        if self.client and self.client.is_connected:
            try:
                await self.client.disconnect()
            except Exception as e:
                log.warning("해제 오류: %s", e)

    async def write_embedding(self, embedding: Embedding) -> bool:
        data = np.asarray(embedding, dtype=np.float32).tobytes()
        try:
            for off in range(0, len(data), EMBED_CHUNK):
                chunk = data[off:off + EMBED_CHUNK]
                payload = off.to_bytes(2, "little") + chunk
                await self.client.write_gatt_char(CHR_EMBEDDING, payload, response=True)
            return True
        except Exception as e:
            log.warning("임베딩 write 실패: %s", e)
            return False

    async def write_seat(self, seat: str) -> bool:
        try:
            await self.client.write_gatt_char(CHR_SEAT, str(seat).encode("utf-8"), response=True)
            return True
        except Exception as e:
            log.warning("좌석 write 실패: %s", e)
            return False

    async def read_embedding(self) -> Optional[Embedding]:
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
            log.warning("임베딩 read 실패: %s", e)
            return None

    async def read_contact_flag(self) -> bool:
        try:
            data = await self.client.read_gatt_char(CHR_FLAG)
            return bool(data and data[0])
        except Exception as e:
            log.warning("체결 플래그 read 실패: %s", e)
            return False

    async def read_wristband_id(self) -> str:
        try:
            data = await self.client.read_gatt_char(CHR_ID)
            return data.decode("utf-8", errors="replace")
        except Exception as e:
            log.warning("팔찌 ID read 실패: %s", e)
            return ""

    async def write_led_effect(self, code: int) -> bool:
        try:
            await self.client.write_gatt_char(CHR_LED, bytes([code & 0xFF]), response=False)
            return True
        except Exception as e:
            log.warning("LED write 실패: %s", e)
            return False

    async def clear_wristband(self) -> bool:
        ok1 = await self.write_embedding(np.zeros(EMBED_DIM, dtype=np.float32))
        ok2 = await self.write_seat("")
        return ok1 and ok2
