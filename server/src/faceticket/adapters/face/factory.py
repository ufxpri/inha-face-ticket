"""얼굴 인식기 생성 — `Settings.face_force_stub` 에 따라 분기."""
from __future__ import annotations

from faceticket.adapters.face.facenet import FacenetRecognizer
from faceticket.adapters.face.stub import HashStubRecognizer
from faceticket.application.ports import IFaceRecognizer
from faceticket.config import Settings


def make_recognizer(settings: Settings) -> IFaceRecognizer:
    """설정에 따라 얼굴 인식기를 생성한다.

    force-stub 모드는 데모/테스트용이므로 무거운 ML 모델 로딩 자체를 피한다.
    """
    if settings.face_force_stub:
        return HashStubRecognizer()

    rec = FacenetRecognizer()
    return rec
