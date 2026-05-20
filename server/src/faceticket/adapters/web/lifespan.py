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
        if s.auto_connect_issuance_port:
            ok, reason = await container.registry.connect("issuance", s.auto_connect_issuance_port)
            log.info("auto-connect issuance [%s] → %s", s.auto_connect_issuance_port, reason)
        elif s.auto_connect_entry_port:
            ok, reason = await container.registry.connect("entry", s.auto_connect_entry_port)
            log.info("auto-connect entry [%s] → %s", s.auto_connect_entry_port, reason)
        try:
            yield
        finally:
            container.registry.disconnect_all()
            container.repo.close()
            log.info("서버 종료")

    return lifespan
