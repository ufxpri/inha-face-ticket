from faceticket.adapters.face import factory
from faceticket.adapters.face.stub import HashStubRecognizer
from faceticket.config import Settings


def test_force_stub_returns_hash_stub_without_constructing_facenet(monkeypatch) -> None:
    class ExplodingFacenetRecognizer:
        def __init__(self) -> None:
            raise AssertionError("FacenetRecognizer should not be constructed")

    monkeypatch.setattr(factory, "FacenetRecognizer", ExplodingFacenetRecognizer)

    recognizer = factory.make_recognizer(Settings(face_force_stub=True))

    assert isinstance(recognizer, HashStubRecognizer)


def test_non_stub_mode_constructs_facenet_recognizer(monkeypatch) -> None:
    class FakeFacenetRecognizer:
        pass

    monkeypatch.setattr(factory, "FacenetRecognizer", FakeFacenetRecognizer)

    recognizer = factory.make_recognizer(Settings(face_force_stub=False))

    assert isinstance(recognizer, FakeFacenetRecognizer)
