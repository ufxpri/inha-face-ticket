"""HTTP 라우트 — admin/tablet 진입, active 목록, 시리얼 포트 조회.

라우트 함수들은 `request.app.state.container` 에서 의존성을 꺼내 쓴다.
"""
from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse

from faceticket.adapters.devices.ports import list_serial_ports
from faceticket.config import TEMPLATES_DIR


def create_router() -> APIRouter:
    r = APIRouter()

    @r.get("/", response_class=HTMLResponse)
    async def root() -> HTMLResponse:
        return HTMLResponse(
            "<h2>오프라인 얼굴인증 전자 티켓 시스템</h2>"
            "<ul>"
            "<li><a href='/admin'>운영자 — 발급/입장/반납 페이지</a></li>"
            "<li><a href='/tablet'>관객 — 태블릿 얼굴 캡처 페이지</a></li>"
            "</ul>"
        )

    @r.get("/admin", response_class=HTMLResponse)
    async def admin_page() -> FileResponse:
        return FileResponse(TEMPLATES_DIR / "admin.html")

    @r.get("/tablet", response_class=HTMLResponse)
    async def tablet_page() -> FileResponse:
        return FileResponse(TEMPLATES_DIR / "tablet.html")

    @r.get("/api/active")
    async def api_active(request: Request) -> JSONResponse:
        repo = request.app.state.container.repo
        return JSONResponse({"items": repo.list_active()})

    @r.get("/api/serial/ports")
    async def api_serial_ports() -> JSONResponse:
        # LAN 노출 주의: 외부에서 호출되면 장치 정보 노출됨. host=127.0.0.1 또는 가드 추가 권장.
        return JSONResponse({"ports": list_serial_ports()})

    return r
