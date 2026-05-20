"""도메인 예외 — 비즈니스 규칙 위반."""
from __future__ import annotations


class DomainError(Exception):
    """비즈니스 규칙 위반의 베이스."""


class FlowConflictError(DomainError):
    """이미 진행 중인 절차가 있는데 새 절차를 시작하려 함."""


class MissingDeviceError(DomainError):
    """운영자 장치가 연결돼 있지 않은 상태에서 진행 시도."""


class MissingEmbeddingError(DomainError):
    """얼굴 임베딩 없이 다음 단계로 진행."""
