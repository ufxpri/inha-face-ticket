"""얼굴 임베딩 추출 포트."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Protocol, runtime_checkable

from faceticket.domain.embedding import Embedding


@dataclass(frozen=True)
class ExtractResult:
    ok: bool
    embedding: Optional[Embedding] = None
    reason: Optional[str] = None


@runtime_checkable
class IFaceRecognizer(Protocol):
    """추출기 — 두 가지 구현이 있다: facenet-pytorch 실제 모델, 해시 기반 stub."""

    async def extract(self, img_bytes: bytes) -> ExtractResult: ...

    @property
    def is_ml_active(self) -> bool: ...

    @property
    def has_ml(self) -> bool: ...

    def set_force_stub(self, on: bool) -> None: ...
