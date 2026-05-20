"""create_app — FastAPI 인스턴스 생성. Container 와 모든 라우트 wiring."""
from __future__ import annotations

from fastapi import FastAPI, WebSocket
from fastapi.staticfiles import StaticFiles

from faceticket.adapters.web.http_routes import create_router
from faceticket.adapters.web.lifespan import make_lifespan
from faceticket.adapters.web.ws_admin import AdminWebSocketHandler
from faceticket.adapters.web.ws_tablet import TabletWebSocketHandler
from faceticket.config import STATIC_DIR


def create_app(container) -> FastAPI:
    """Container 를 받아 FastAPI 앱을 빌드. container 는 app.state 에 보관."""
    app = FastAPI(lifespan=make_lifespan(container))
    app.state.container = container

    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
    app.include_router(create_router())

    admin_handler = AdminWebSocketHandler(
        admins=container.admins,
        flow_runner=container.flow_runner,
        toggles=container.toggles,
        devices=container.device_service,
    )
    tablet_handler = TabletWebSocketHandler(
        tablets=container.tablets,
        face=container.face,
        flow_runner=container.flow_runner,
        presenter=container.presenter,
        toggles=container.toggles,
    )

    @app.websocket("/ws/admin")
    async def ws_admin(ws: WebSocket):
        await admin_handler(ws)

    @app.websocket("/ws/tablet")
    async def ws_tablet(ws: WebSocket):
        await tablet_handler(ws)

    return app
