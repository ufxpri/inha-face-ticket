"""FastAPI lifespan — 시작 시 자동연결, 종료 시 자원 정리."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

log = logging.getLogger(__name__)


def make_lifespan(container):
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        log.info("서버 기동")
        s = container.settings
        port = s.auto_connect_operator_port
        if port:
            ok = await container.device.connect(port)
            log.info("auto-connect operator [%s] → %s", port, "OK" if ok else "fail")
        try:
            yield
        finally:
            try:
                container.device.disconnect()
            except Exception:
                pass
            container.repo.close()
            log.info("서버 종료")

    return lifespan
