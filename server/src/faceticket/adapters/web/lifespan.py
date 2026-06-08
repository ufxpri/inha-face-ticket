"""FastAPI lifespan — 시작 시 자동연결, 종료 시 자원 정리."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from faceticket.application.ports import ROLE_GATE, ROLE_NFC

log = logging.getLogger(__name__)


def make_lifespan(container):
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        log.info("서버 기동")
        s = container.settings
        # 역할별 포트가 지정되면 각각 연결, 아니면 FT_OPERATOR_PORT 로 두 역할을 같은 포트에.
        role_ports = [(ROLE_NFC, s.auto_connect_nfc_port), (ROLE_GATE, s.auto_connect_gate_port)]
        if any(p for _, p in role_ports):
            for role, port in role_ports:
                if port:
                    ok = await container.device.connect_role(role, port)
                    log.info("auto-connect operator[%s] [%s] → %s", role, port, "OK" if ok else "fail")
        elif s.auto_connect_operator_port:
            port = s.auto_connect_operator_port
            ok = await container.device.connect(port)
            log.info("auto-connect operator [%s] (both roles) → %s", port, "OK" if ok else "fail")
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
