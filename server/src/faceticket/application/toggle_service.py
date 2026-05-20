"""face/ble mock 런타임 토글 + 시스템 스냅샷."""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Optional

from faceticket.application.ports import IFaceRecognizer, IPresenter
from faceticket.config import COSINE_THRESHOLD
from faceticket.domain.session import Session

if TYPE_CHECKING:
    from faceticket.adapters.ble.swap import BleSwap
    from faceticket.adapters.devices.registry import DeviceRegistry
    from faceticket.adapters.devices.ports import list_serial_ports

log = logging.getLogger(__name__)


class ToggleService:
    """face/ble 의 mock ↔ real 전환. 진행 중 토글은 거부."""

    def __init__(
        self,
        *,
        face: IFaceRecognizer,
        ble_swap: "BleSwap",
        registry: "DeviceRegistry",
        session: Session,
        presenter: IPresenter,
        tablet_count_provider,                 # () -> int
    ) -> None:
        self.face = face
        self.ble_swap = ble_swap
        self.registry = registry
        self.session = session
        self.presenter = presenter
        self._tablet_count = tablet_count_provider

    # ── 토글 ─────────────────────────────────────────────────
    async def toggle(self, layer: str, mock: bool) -> None:
        if self.session.busy:
            await self.presenter.emit_log("진행 중에는 mock 전환 불가 — CANCEL 후 가능", "warn")
            await self.broadcast_flags()
            return

        if layer == "face":
            if not self.face.has_ml and not mock:
                await self.presenter.emit_log("face: ML 모델이 로드되지 않음 — stub 유지", "warn")
            else:
                self.face.set_force_stub(mock)
                await self.presenter.emit_log(f"face → {'STUB' if mock else 'ML'}")
        elif layer == "ble":
            ok = self.ble_swap.set_mock(mock)
            if not ok:
                await self.presenter.emit_log(
                    "ble: real backend 사용 불가 (bleak 미설치) — MOCK 유지", "warn"
                )
            else:
                await self.presenter.emit_log(f"ble → {'MOCK' if mock else 'REAL'}")
        else:
            await self.presenter.emit_log(f"알 수 없는 토글 layer: {layer}", "warn")
            return

        await self.broadcast_flags()

    # ── 스냅샷 / 플래그 송신 ──────────────────────────────────
    def snapshot(self) -> dict:
        # adapters 의존을 런타임에 lazy import 해서 순환 회피
        from faceticket.adapters.devices.ports import list_serial_ports

        snap = {
            "ml":               self.face.is_ml_active,
            "ble_mock":         self.ble_swap.is_mock,
            "face_available":   self.face.has_ml,
            "ble_available":    self.ble_swap.real_available,
            "tablet_clients":   self._tablet_count(),
            "cosine_threshold": COSINE_THRESHOLD,
            "available_ports":  list_serial_ports(),
        }
        snap.update(self.registry.snapshot())
        return snap

    async def broadcast_flags(self) -> None:
        await self.presenter.emit_flags(self.snapshot())
