"""반납 플로우 — 팔찌 태그 → BLE clear → DB 업데이트."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

from faceticket.application.flows._base import FlowBase
from faceticket.application.ports import IIssueRepository
from faceticket.domain.states import Flow, FlowState

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class ReturnOutcome:
    ok: bool
    wristband_id: str = ""
    returned: bool = False         # DB 에 활성 기록이 있어 변경됐는지
    reason: Optional[str] = None


class ReturnFlow(FlowBase):
    def __init__(self, *, repo: IIssueRepository, **kw) -> None:
        super().__init__(**kw)
        self.repo = repo

    async def start(self) -> None:
        self.require_device()
        self.session.start(Flow.RETURN)
        await self.presenter.emit_log("반납 절차 시작 — 팔찌 인식으로 자동 진입합니다.")
        await self.presenter.emit_state(FlowState.AWAIT_TAG)

    async def on_tag(self) -> ReturnOutcome:
        dev = self.require_device()

        await self.presenter.emit_log("팔찌를 NFC 리더에 대주세요 — wake 대기 중 (최대 15초)")
        if not await dev.wake_wristband_wait():
            return ReturnOutcome(False, reason="wake 실패")

        async with self.ble_session() as connected:
            if not connected:
                return ReturnOutcome(False, reason="BLE 연결 실패")
            wid = await self.ble.read_wristband_id()
            await self.ble.clear_wristband()

        await dev.clear_wristband()
        found = self.repo.record_return(wid)
        await self.presenter.emit_log(
            f"반납 완료 — 팔찌 {wid} 초기화"
            + ("" if found else " (DB에 활성 기록 없음)")
        )
        return ReturnOutcome(True, wristband_id=wid, returned=found)
