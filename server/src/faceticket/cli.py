"""CLI 엔트리 — uvicorn 으로 앱 부팅. `python -m faceticket` 으로 호출."""
from __future__ import annotations

import argparse
import logging
from pathlib import Path

import uvicorn

from faceticket.adapters.web import create_app
from faceticket.config import DEFAULT_SSL_CERT, DEFAULT_SSL_KEY, load_settings
from faceticket.infra import build_container, configure_logging, ensure_self_signed_cert


def main() -> None:
    parser = argparse.ArgumentParser(prog="faceticket")
    parser.add_argument("--host", default=None, help="bind host (기본 환경변수 FT_HOST 또는 0.0.0.0)")
    parser.add_argument("--port", type=int, default=None, help="bind port (기본 FT_PORT 또는 8000)")
    parser.add_argument("--reload", action="store_true", help="auto-reload (개발용)")
    parser.add_argument("--log-level", default="info")
    parser.add_argument("--no-ssl", action="store_true",
                        help="HTTPS 비활성화 (기본은 자체 서명 인증서로 HTTPS 활성)")
    parser.add_argument("--cert", default=None, help="TLS 인증서(PEM) 경로 — 미지정 시 자동 생성")
    parser.add_argument("--key", default=None, help="TLS 비밀키(PEM) 경로 — 미지정 시 자동 생성")
    args = parser.parse_args()

    configure_logging(level=getattr(logging, args.log_level.upper(), logging.INFO))

    settings = load_settings()
    host = args.host or settings.host
    port = args.port if args.port is not None else settings.port

    container = build_container(settings)
    app = create_app(container)

    ssl_enabled = settings.ssl_enabled and not args.no_ssl
    ssl_kwargs: dict = {}
    if ssl_enabled:
        cert_path = Path(args.cert or settings.ssl_cert or DEFAULT_SSL_CERT)
        key_path = Path(args.key or settings.ssl_key or DEFAULT_SSL_KEY)
        ensure_self_signed_cert(cert_path, key_path)
        ssl_kwargs = {"ssl_certfile": str(cert_path), "ssl_keyfile": str(key_path)}

    # reload 모드는 string app 이 필요해 별도 분기 — 그 외엔 인스턴스로 직접 실행
    if args.reload:
        uvicorn.run("faceticket.cli:_app_factory", host=host, port=port,
                    reload=True, factory=True, **ssl_kwargs)
    else:
        uvicorn.run(app, host=host, port=port, **ssl_kwargs)


def _app_factory():
    """uvicorn --reload 의 factory 진입점. 매 reload 마다 새 container."""
    configure_logging()
    return create_app(build_container(load_settings()))


if __name__ == "__main__":
    main()
