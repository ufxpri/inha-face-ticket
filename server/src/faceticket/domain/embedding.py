"""임베딩 타입 + 순수 벡터 연산."""
from __future__ import annotations

import numpy as np

Embedding = np.ndarray   # shape (EMBED_DIM,), dtype=float32, L2-normalized (||v|| ≈ 1)


def l2_normalize(v: np.ndarray) -> Embedding:
    """L2 정규화. 0-벡터는 그대로 반환."""
    a = np.asarray(v, dtype=np.float32).ravel()
    n = float(np.linalg.norm(a))
    if n < 1e-8:
        return a
    return (a / n).astype(np.float32)


def cosine(a: np.ndarray, b: np.ndarray) -> float:
    """코사인 유사도. 두 벡터 모두 L2-normalized 라면 사실상 내적과 동일."""
    a = np.asarray(a, dtype=np.float32).ravel()
    b = np.asarray(b, dtype=np.float32).ravel()
    denom = float(np.linalg.norm(a) * np.linalg.norm(b))
    if denom < 1e-8:
        return 0.0
    return float(np.dot(a, b) / denom)


def is_zero_embedding(v: np.ndarray, tol: float = 1e-6) -> bool:
    """팔찌가 발급된 적 없는 경우 (전부 0) 검사."""
    return float(np.linalg.norm(np.asarray(v, dtype=np.float32))) < tol
