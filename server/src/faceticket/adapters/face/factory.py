"""얼굴 인식기 생성 — `Settings.face_force_stub` 에 따라 분기."""
from __future__ import annotations

from faceticket.adapters.face.facenet import FacenetRecognizer
from faceticket.application.ports import IFaceRecognizer
from faceticket.config import Settings


def make_recognizer(settings: Settings) -> IFaceRecognizer:
    """FacenetRecognizer 한 종류만 반환 — 그 안에서 ML 가능 여부 + force_stub 분기."""
    rec = FacenetRecognizer()
    rec.set_force_stub(settings.face_force_stub)
    return rec
