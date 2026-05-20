"""해시 기반 의사 임베딩 — facenet-pytorch 미설치 환경 또는 force_stub=True 시 사용.

이미지 SHA-256 → 시드 → np.random.RandomState → L2 정규화. 같은 이미지는 항상 같은
임베딩이 나오므로 동일 사진을 두 번 캡처하면 코사인 ≈ 1.0 이고, 다른 이미지면 ≈ 0.
"""
from __future__ import annotations

import hashlib

import numpy as np

from faceticket.application.ports import ExtractResult, IFaceRecognizer
from faceticket.config import EMBED_DIM
from faceticket.domain.embedding import l2_normalize


class HashStubRecognizer(IFaceRecognizer):
    """ML 의존성 없는 결정적 stub. 항상 성공."""

    has_ml: bool = False

    def __init__(self) -> None:
        self._force_stub = True   # stub 은 항상 stub

    @property
    def is_ml_active(self) -> bool:
        return False

    def set_force_stub(self, on: bool) -> None:
        # stub-only 이므로 변경 의미 없음
        pass

    async def extract(self, img_bytes: bytes) -> ExtractResult:
        h = hashlib.sha256(img_bytes).digest()
        rng = np.random.RandomState(int.from_bytes(h[:4], "big"))
        v = rng.randn(EMBED_DIM).astype(np.float32)
        return ExtractResult(ok=True, embedding=l2_normalize(v))
