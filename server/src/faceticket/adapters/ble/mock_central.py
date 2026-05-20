"""메모리상 가짜 팔찌 — 펌웨어 없이도 발급/입장/반납 흐름 동작."""
from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Optional

import numpy as np

from faceticket.application.ports import IBleCentral
from faceticket.config import EMBED_DIM
from faceticket.domain.embedding import Embedding

log = logging.getLogger(__name__)


class MockBleCentral(IBleCentral):
    """연결/쓰기/읽기 모두 즉시 성공. 임베딩 + 좌석 + flag 를 메모리에 보관."""

    def __init__(self) -> None:
        self._state: Optional[dict] = None

    def _ensure(self) -> dict:
        if self._state is None:
            self._state = {
                "id": "MOCK-" + uuid.uuid4().hex[:8].upper(),
                "embedding": np.zeros(EMBED_DIM, dtype=np.float32),
                "seat": "",
                "flag": False,
            }
        return self._state

    async def connect_wristband(self, timeout: float = 15.0) -> bool:
        await asyncio.sleep(0.3)
        self._ensure()
        log.info("팔찌 연결 시뮬레이트")
        return True

    async def disconnect(self) -> None:
        return None

    async def write_embedding(self, embedding: Embedding) -> bool:
        data = np.asarray(embedding, dtype=np.float32).tobytes()
        self._ensure()["embedding"] = np.frombuffer(data, dtype=np.float32).copy()
        log.info("임베딩 write (%dB)", len(data))
        return True

    async def write_seat(self, seat: str) -> bool:
        self._ensure()["seat"] = seat
        log.info("좌석 write: %s", seat)
        return True

    async def read_embedding(self) -> Optional[Embedding]:
        return self._ensure()["embedding"].copy()

    async def read_contact_flag(self) -> bool:
        return self._ensure()["flag"]

    async def read_wristband_id(self) -> str:
        return self._ensure()["id"]

    async def write_led_effect(self, code: int) -> bool:
        log.info("LED 효과 코드 %#04x", code)
        return True

    async def clear_wristband(self) -> bool:
        s = self._ensure()
        s["embedding"] = np.zeros(EMBED_DIM, dtype=np.float32)
        s["seat"] = ""
        s["flag"] = False
        return True
