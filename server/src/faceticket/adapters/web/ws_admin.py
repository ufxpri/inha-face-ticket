"""/ws/admin 엔드포인트 — admin 명령을 파싱해 FlowRunner / DeviceService / ToggleService 로 dispatch."""
from __future__ import annotations

import logging

from fastapi import WebSocket, WebSocketDisconnect

from faceticket.adapters.web import ws_protocol as wp
from faceticket.adapters.web.client_pool import ClientPool
from faceticket.application.device_service import DeviceService
from faceticket.application.flow_runner import FlowRunner
from faceticket.application.ports import ROLE_NFC
from faceticket.application.toggle_service import ToggleService

log = logging.getLogger(__name__)


class AdminWebSocketHandler:
    def __init__(
        self,
        *,
        admins: ClientPool,
        flow_runner: FlowRunner,
        toggles: ToggleService,
        devices: DeviceService,
    ) -> None:
        self.admins = admins
        self.flow = flow_runner
        self.toggles = toggles
        self.devices = devices

    async def __call__(self, ws: WebSocket) -> None:
        await ws.accept()
        self.admins.add(ws)
        try:
            await ws.send_json(wp.msg_hello("admin", **self.toggles.snapshot()))
            while True:
                data = await ws.receive_json()
                await self._dispatch(wp.parse_admin_message(data))
        except WebSocketDisconnect:
            pass
        except RuntimeError as e:
            if not wp.is_disconnect_runtime_error(e):
                log.exception("/ws/admin")
        except Exception:
            log.exception("/ws/admin")
        finally:
            self.admins.remove(ws)

    async def _dispatch(self, cmd: wp.AdminCommand) -> None:
        t = cmd.type
        # 팔찌 태그 단계는 자동 진입(서버 주도) — 별도 *_tag 메시지는 받지 않는다.
        if t == "issue_start":
            await self.flow.issue_start(cmd.seat, cmd.name)
        elif t == "entry_start":
            await self.flow.entry_start()
        elif t == "return_start":
            await self.flow.return_start()
        elif t == "cancel":
            await self.flow.cancel()
        elif t == "list_active":
            await self.flow.list_active()
        elif t == "toggle":
            await self.toggles.toggle(cmd.layer, cmd.mock)
        elif t == "io_connect":
            await self.devices.connect(cmd.port, cmd.role or ROLE_NFC)
        elif t == "io_disconnect":
            await self.devices.disconnect(cmd.role or ROLE_NFC)
        elif t == "io_refresh_ports":
            await self.devices.refresh_ports()
        elif t == "led":
            await self.devices.set_led(cmd.command)
        elif t == "led_stop":
            await self.devices.stop_led()
        else:
            log.warning("알 수 없는 admin 메시지: %s", t)
