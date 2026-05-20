"""facenet-pytorch 기반 실제 인식기.

MTCNN 으로 검출/키포인트 → 정면도 검사 → InceptionResnetV1(vggface2) 로 512-d 임베딩.
force_stub=True 인 경우 모델이 있어도 stub 으로 폴백.
"""
from __future__ import annotations

import asyncio
import io
import logging

import numpy as np
from PIL import Image

from faceticket.adapters.face.stub import HashStubRecognizer
from faceticket.application.ports import ExtractResult, IFaceRecognizer
from faceticket.domain.embedding import l2_normalize
from faceticket.domain.frontality import check_frontal

log = logging.getLogger(__name__)


def _try_import_ml():
    """torch + facenet-pytorch 임포트 시도. 실패 시 (None, None, error)."""
    try:
        import torch
        from facenet_pytorch import MTCNN, InceptionResnetV1
        return torch, (MTCNN, InceptionResnetV1), None
    except BaseException as e:
        return None, None, repr(e)


class FacenetRecognizer(IFaceRecognizer):
    """ML 백엔드. ML 임포트 실패 시 stub 으로 자동 폴백."""

    def __init__(self) -> None:
        self._force_stub = False
        self._stub = HashStubRecognizer()

        torch, models, err = _try_import_ml()
        if torch is None:
            log.info("facenet-pytorch 사용 불가(%s) — stub 모드", err)
            self._torch = None
            self._mtcnn = None
            self._resnet = None
            self._device = None
            return

        MTCNN, InceptionResnetV1 = models
        self._torch = torch
        self._device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        log.info("PyTorch device = %s", self._device)
        self._mtcnn = MTCNN(image_size=160, margin=20, post_process=True,
                            select_largest=True, keep_all=False, device=self._device)
        self._resnet = InceptionResnetV1(pretrained="vggface2").eval().to(self._device)
        log.info("facenet-pytorch 모델 로드 완료 (InceptionResnetV1 / vggface2, 512-d)")

    @property
    def has_ml(self) -> bool:
        return self._torch is not None

    @property
    def is_ml_active(self) -> bool:
        return self.has_ml and not self._force_stub

    def set_force_stub(self, on: bool) -> None:
        self._force_stub = bool(on)

    async def extract(self, img_bytes: bytes) -> ExtractResult:
        if not self.is_ml_active:
            return await self._stub.extract(img_bytes)

        try:
            img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        except Exception as e:
            return ExtractResult(False, reason=f"이미지 디코드 실패: {e}")

        # 무거운 추론은 스레드풀에서
        loop = asyncio.get_running_loop()
        try:
            v = await loop.run_in_executor(None, self._extract_sync, img)
        except _ExtractFailure as e:
            return ExtractResult(False, reason=str(e))
        except Exception as e:
            log.exception("임베딩 추출")
            return ExtractResult(False, reason=f"임베딩 추출 오류: {e}")

        return ExtractResult(True, embedding=v)

    # ── sync helpers (run_in_executor 내부에서 실행) ──────────
    def _extract_sync(self, img: Image.Image) -> np.ndarray:
        boxes, probs, lmks = self._mtcnn.detect(img, landmarks=True)
        if boxes is None or len(boxes) == 0:
            raise _ExtractFailure("얼굴 미검출 — 카메라 정면으로 와주세요")

        box   = boxes[0]
        prob  = float(probs[0]) if probs is not None else 0.0
        lmk   = lmks[0]

        result = check_frontal(box, prob, lmk, img.width)
        log.debug("det prob=%.3f metrics=%s -> %s",
                  prob, {k: round(v, 3) for k, v in result.metrics.items()},
                  "OK" if result.ok else result.reason)
        if not result.ok:
            raise _ExtractFailure(result.reason or "정면도 검사 실패")

        face_tensor = self._mtcnn(img)
        if face_tensor is None:
            raise _ExtractFailure("얼굴 크롭 실패")
        if face_tensor.ndim == 3:
            face_tensor = face_tensor.unsqueeze(0)

        with self._torch.no_grad():
            emb = self._resnet(face_tensor.to(self._device))
        return l2_normalize(emb.detach().cpu().numpy())


class _ExtractFailure(Exception):
    """내부 — sync helper 가 거부 사유를 비동기 wrapper 로 올리기 위한 시그널."""
