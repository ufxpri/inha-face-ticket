"""운영자 장치 connect/disconnect 유스케이스 — 단일 장치 모델."""
from __future__ import annotations

import logging

from faceticket.application.ports import IOperatorDevice, IPresenter
from faceticket.domain.session import Session

log = logging.getLogger(__name__)


class DeviceService:
    """장치 연결 변경 — 진행 중일 땐 거부, 변경 후 flags broadcast."""

    def __init__(
        self,
        *,
        device: IOperatorDevice,
        session: Session,
        presenter: IPresenter,
        flags_emitter,             # async () -> None
    ) -> None:
        self.device = device
        self.session = session
        self.presenter = presenter
        self._emit_flags = flags_emitter

    async def connect(self, port: str) -> None:
        if self.session.busy:
            await self.presenter.emit_log("진행 중에는 장치 연결 변경 불가 — CANCEL 후 가능", "warn")
            await self._emit_flags()
            return
        if not port:
            await self.presenter.emit_log("operator: 포트 미지정", "warn")
            return
        if self.device.is_connected:
            await self.presenter.emit_log("operator: 이미 연결됨", "warn")
            await self._emit_flags()
            return
        ok = await self.device.connect(port)
        await self.presenter.emit_log(
            f"operator connect [{port}] — {'연결 성공' if ok else f'{port} 열기 실패'}",
            "info" if ok else "warn",
        )
        await self._emit_flags()

    async def disconnect(self) -> None:
        if self.session.busy:
            await self.presenter.emit_log("진행 중에는 장치 해제 불가 — CANCEL 후 가능", "warn")
            await self._emit_flags()
            return
        if not self.device.is_connected:
            await self.presenter.emit_log("operator: 이미 해제됨", "info")
            return
        self.device.disconnect()
        await self.presenter.emit_log("operator disconnect — 해제됨", "info")
        await self._emit_flags()

    async def refresh_ports(self) -> None:
        await self._emit_flags()
