import logging

import pytest

from faceticket.adapters.web.client_pool import ClientPool
from faceticket.adapters.web.ws_admin import AdminWebSocketHandler
from faceticket.adapters.web.ws_tablet import TabletWebSocketHandler

pytestmark = pytest.mark.asyncio


class RuntimeClosingWebSocket:
    def __init__(self) -> None:
        self.accepted = False
        self.sent: list[dict] = []

    async def accept(self) -> None:
        self.accepted = True

    async def send_json(self, payload: dict) -> None:
        self.sent.append(payload)

    async def receive_json(self) -> dict:
        raise RuntimeError('WebSocket is not connected. Need to call "accept" first.')


class FakeToggles:
    def __init__(self) -> None:
        self.broadcasts = 0

    def snapshot(self) -> dict:
        return {}

    async def broadcast_flags(self) -> None:
        self.broadcasts += 1


async def test_admin_handler_treats_disconnect_runtime_error_as_normal(caplog) -> None:
    admins = ClientPool()
    ws = RuntimeClosingWebSocket()
    handler = AdminWebSocketHandler(
        admins=admins,
        flow_runner=object(),
        toggles=FakeToggles(),
        devices=object(),
    )

    caplog.set_level(logging.ERROR, logger="faceticket.adapters.web.ws_admin")

    await handler(ws)

    assert ws.accepted is True
    assert ws.sent == [{"type": "hello", "role": "admin"}]
    assert len(admins) == 0
    assert not [r for r in caplog.records if r.name == "faceticket.adapters.web.ws_admin"]


async def test_tablet_handler_treats_disconnect_runtime_error_as_normal(caplog) -> None:
    tablets = ClientPool()
    toggles = FakeToggles()
    ws = RuntimeClosingWebSocket()
    handler = TabletWebSocketHandler(
        tablets=tablets,
        face=object(),
        flow_runner=object(),
        presenter=object(),
        toggles=toggles,
    )

    caplog.set_level(logging.ERROR, logger="faceticket.adapters.web.ws_tablet")

    await handler(ws)

    assert ws.accepted is True
    assert ws.sent == [{"type": "hello", "role": "tablet", "cosine_threshold": 0.55}]
    assert toggles.broadcasts == 2
    assert len(tablets) == 0
    assert not [r for r in caplog.records if r.name == "faceticket.adapters.web.ws_tablet"]
