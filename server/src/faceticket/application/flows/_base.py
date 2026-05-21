"""공통 헬퍼 — 세 플로우가 공유하는 BLE 세션 컨텍스트 / 장치 확보."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

from faceticket.domain.errors import MissingDeviceError

if TYPE_CHECKING:
    from faceticket.application.ports import IBleCentral, IOperatorDevice, IPresenter
    from faceticket.domain.session import Session

log = logging.getLogger(__name__)


class FlowBase:
    """모든 플로우가 공유하는 의존성 + 헬퍼."""

    def __init__(
        self,
        *,
        ble: "IBleCentral",
        device: "IOperatorDevice",
        session: "Session",
        presenter: "IPresenter",
    ) -> None:
        self.ble = ble
        self.device = device
        self.session = session
        self.presenter = presenter

    # ── 장치 확보 ─────────────────────────────────────────────
    def require_device(self) -> "IOperatorDevice":
        if not self.device.is_connected:
            raise MissingDeviceError("운영자 장치 미연결 — admin 패널에서 연결 후 시도")
        return self.device

    # ── BLE 컨텍스트 ──────────────────────────────────────────
    @asynccontextmanager
    async def ble_session(self, timeout: float = 15.0):
        ok = await self.ble.connect_wristband(timeout=timeout)
        try:
            yield ok
        finally:
            try:
                await self.ble.disconnect()
            except Exception as e:
                log.warning("BLE disconnect 오류: %s", e)

    async def _safe_ble_disconnect(self) -> None:
        try:
            await self.ble.disconnect()
        except Exception:
            pass
