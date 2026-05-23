"""개발용 실행 진입점 — `python run.py` 한 줄로 부팅.

빌드/설치 단계 없음. src/ 를 sys.path 에 얹고 uvicorn 으로 바로 띄운다.
설정은 환경변수: FT_HOST / FT_PORT / FT_SSL (기본 1) / FT_SSL_CERT / FT_SSL_KEY /
FT_BLE_MOCK / FT_FACE_STUB / FT_OPERATOR_PORT / FT_SERIAL_BAUD.
"""
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / "src"))

import uvicorn  # noqa: E402

from faceticket.adapters.web import create_app  # noqa: E402
from faceticket.config import DEFAULT_SSL_CERT, DEFAULT_SSL_KEY, load_settings  # noqa: E402
from faceticket.infra import build_container, configure_logging, ensure_self_signed_cert  # noqa: E402

if __name__ == "__main__":
    configure_logging()
    settings = load_settings()
    app = create_app(build_container(settings))

    ssl_kwargs: dict = {}
    if settings.ssl_enabled:
        cert = pathlib.Path(settings.ssl_cert or DEFAULT_SSL_CERT)
        key = pathlib.Path(settings.ssl_key or DEFAULT_SSL_KEY)
        ensure_self_signed_cert(cert, key)
        ssl_kwargs = {"ssl_certfile": str(cert), "ssl_keyfile": str(key)}

    uvicorn.run(app, host=settings.host, port=settings.port, **ssl_kwargs)
