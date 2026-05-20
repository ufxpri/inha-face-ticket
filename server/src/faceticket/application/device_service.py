"""운영자 장치 connect/disconnect 유스케이스."""
from __future__ import annotations

import logging

from faceticket.application.ports import IPresenter
from faceticket.application.ports.device_port import OperatorDeviceKey
from faceticket.domain.session import Session

log = logging.getLogger(__name__)


class DeviceService:
    """장치 연결 변경 — 진행 중일 땐 거부, 변경 후 flags broadcast."""

    def __init__(
        self,
        *,
        registry,                  # adapters.devices.registry.DeviceRegistry (cycle 회피용 lazy import 안 함)
        session: Session,
        presenter: IPresenter,
        flags_emitter,             # async () -> None
    ) -> None:
        self.registry = registry
        self.session = session
        self.presenter = presenter
        self._emit_flags = flags_emitter

    async def connect(self, key: OperatorDeviceKey, port: str) -> None:
        if self.session.busy:
            await self.presenter.emit_log("진행 중에는 장치 연결 변경 불가 — CANCEL 후 가능", "warn")
            await self._emit_flags()
            return
        if not port:
            await self.presenter.emit_log(f"{key}: 포트 미지정", "warn")
            return
        ok, reason = await self.registry.connect(key, port)
        await self.presenter.emit_log(
            f"{key} connect [{port}] — {reason}", "info" if ok else "warn"
        )
        await self._emit_flags()

    async def disconnect(self, key: OperatorDeviceKey) -> None:
        if self.session.busy:
            await self.presenter.emit_log("진행 중에는 장치 해제 불가 — CANCEL 후 가능", "warn")
            await self._emit_flags()
            return
        ok, reason = self.registry.disconnect(key)
        await self.presenter.emit_log(
            f"{key} disconnect — {reason}", "info" if ok else "warn"
        )
        await self._emit_flags()

    async def refresh_ports(self) -> None:
        await self._emit_flags()
