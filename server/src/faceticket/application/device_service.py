"""운영자 장치 connect/disconnect 유스케이스 — 역할(NFC/GATE)별 라우팅.

NFC 리더와 입장 게이트가 서로 다른 포트에 있으므로 connect/disconnect 는 대상 role 을
받는다. 진행 중일 땐 거부, 변경 후 flags broadcast.
"""
from __future__ import annotations

import logging

from faceticket.application.ports import ROLE_NFC, ROLES, IOperatorDevice, IPresenter
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

    def _role_connected(self, role: str) -> bool:
        return bool(self.device.status_snapshot().get(role, {}).get("connected"))

    async def connect(self, port: str, role: str = ROLE_NFC) -> None:
        if role not in ROLES:
            await self.presenter.emit_log(f"operator: 알 수 없는 역할 [{role}]", "warn")
            return
        if self.session.busy:
            await self.presenter.emit_log("진행 중에는 장치 연결 변경 불가 — CANCEL 후 가능", "warn")
            await self._emit_flags()
            return
        if not port:
            await self.presenter.emit_log(f"operator[{role}]: 포트 미지정", "warn")
            return
        if self._role_connected(role):
            await self.presenter.emit_log(f"operator[{role}]: 이미 연결됨", "warn")
            await self._emit_flags()
            return
        ok = await self.device.connect_role(role, port)
        await self.presenter.emit_log(
            f"operator[{role}] connect [{port}] — {'연결 성공' if ok else f'{port} 열기 실패'}",
            "info" if ok else "warn",
        )
        await self._emit_flags()

    async def disconnect(self, role: str = ROLE_NFC) -> None:
        if role not in ROLES:
            await self.presenter.emit_log(f"operator: 알 수 없는 역할 [{role}]", "warn")
            return
        if self.session.busy:
            await self.presenter.emit_log("진행 중에는 장치 해제 불가 — CANCEL 후 가능", "warn")
            await self._emit_flags()
            return
        if not self._role_connected(role):
            await self.presenter.emit_log(f"operator[{role}]: 이미 해제됨", "info")
            return
        self.device.disconnect_role(role)
        await self.presenter.emit_log(f"operator[{role}] disconnect — 해제됨", "info")
        await self._emit_flags()

    async def refresh_ports(self) -> None:
        await self._emit_flags()
