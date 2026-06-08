"""FlowRunner — 세 플로우 중 진행 중인 것을 보관하고 메시지를 라우팅.

기존 `FlowController` 의 230줄 god-class 를 분해한 결과. 비즈니스 로직은 각 Flow 객체에
있고, 여기서는 dispatch + 완료/실패 처리 + 세션 리셋만.
"""
from __future__ import annotations

import asyncio
import logging

from faceticket.application.flows import EntryFlow, IssueFlow, ReturnFlow
from faceticket.application.flows.entry import EntryFaceResult, EntryTagResult
from faceticket.application.flows.issuance import IssueOutcome
from faceticket.application.flows.return_ import ReturnOutcome
from faceticket.application.ports import IIssueRepository, IPresenter
from faceticket.domain.embedding import Embedding
from faceticket.domain.errors import DomainError
from faceticket.domain.session import Session
from faceticket.domain.states import Flow, FlowState

log = logging.getLogger(__name__)

# DONE → IDLE 자동 전이까지 대기 시간 (브라우저가 결과를 보여줄 여유)
DONE_LINGER_SECONDS = 2.0


class FlowRunner:
    """진행 중인 플로우를 들고 있는 단일 owner. 세션 리셋도 여기서 한다."""

    def __init__(
        self,
        *,
        issue: IssueFlow,
        entry: EntryFlow,
        return_: ReturnFlow,
        session: Session,
        repo: IIssueRepository,
        presenter: IPresenter,
    ) -> None:
        self.issue = issue
        self.entry = entry
        self.return_ = return_
        self.session = session
        self.repo = repo
        self.presenter = presenter

    # ── public dispatch ──────────────────────────────────────
    async def issue_start(self, seat: str, name: str) -> None:
        if not await self._guard_idle("발급 시작"):
            return
        await self._safe(self.issue.start(seat, name))

    async def issue_tag(self) -> None:
        if self.session.flow != Flow.ISSUE:
            return
        outcome = await self._safe_outcome(self.issue.on_tag(), IssueOutcome(False, reason="내부 오류"))
        if outcome.ok:
            await self.presenter.emit_complete(True, "발급 완료",
                                               flow=Flow.ISSUE.value,
                                               wristband_id=outcome.wristband_id,
                                               seat=outcome.seat)
            await self._mark_done(wristband_id=outcome.wristband_id, seat=outcome.seat)
        else:
            await self._abort(outcome.reason or "발급 실패")

    async def entry_start(self) -> None:
        if not await self._guard_idle("입장 시작"):
            return
        await self._safe(self.entry.start())
        # START 직후 곧바로 팔찌 대기(wake)로 자동 진입 — 별도 TAGGED 클릭 제거.
        # entry_tag 는 flow==ENTRY 가드가 있어, start 가 실패/abort 했으면 자동 no-op.
        await self.entry_tag()

    async def entry_tag(self) -> None:
        if self.session.flow != Flow.ENTRY:
            return
        result = await self._safe_outcome(
            self.entry.on_tag(), EntryTagResult(False, "내부 오류")
        )
        if not result.ok:
            await self._abort(result.reason or "입장 단계 실패")

    async def return_start(self) -> None:
        if not await self._guard_idle("반납 시작"):
            return
        await self._safe(self.return_.start())
        # START 직후 곧바로 팔찌 대기(wake)로 자동 진입 — 별도 TAGGED 클릭 제거.
        await self.return_tag()

    async def return_tag(self) -> None:
        if self.session.flow != Flow.RETURN:
            return
        outcome = await self._safe_outcome(self.return_.on_tag(), ReturnOutcome(False, reason="내부 오류"))
        if outcome.ok:
            await self.presenter.emit_complete(True, "반납 완료",
                                               flow=Flow.RETURN.value,
                                               wristband_id=outcome.wristband_id,
                                               returned=outcome.returned)
            await self._mark_done(wristband_id=outcome.wristband_id, returned=outcome.returned)
        else:
            await self._abort(outcome.reason or "반납 실패")

    async def face_captured(self, embedding: Embedding) -> None:
        """태블릿이 임베딩을 보냈을 때 — 현재 플로우에 따라 dispatch."""
        if self.session.flow == Flow.ISSUE:
            await self._safe(self.issue.on_face_captured(embedding))
            # 얼굴 임베딩 확보 직후 곧바로 팔찌 대기(wake)로 자동 진입 — 별도 TAGGED 클릭 제거.
            # issue_tag 는 flow==ISSUE 가드가 있어, 캡처 처리가 실패/abort 했으면 자동 no-op.
            await self.issue_tag()
        elif self.session.flow == Flow.ENTRY:
            result = await self._safe_outcome(
                self.entry.on_face_captured(embedding),
                EntryFaceResult(False, 0.0, "내부 오류"),
            )
            await self.presenter.emit_complete(result.passed, result.message,
                                               flow=Flow.ENTRY.value,
                                               similarity=result.similarity)
            await self._mark_done(similarity=result.similarity, passed=result.passed)

    async def cancel(self) -> None:
        await self.presenter.emit_log("절차 취소", "warn")
        await self._abort_no_log()

    async def list_active(self) -> None:
        await self.presenter.emit_active_list(self.repo.list_active())

    # ── 내부 헬퍼 ────────────────────────────────────────────
    async def _guard_idle(self, label: str) -> bool:
        if self.session.busy:
            await self.presenter.emit_log(
                f"{label}: 이미 진행 중인 절차가 있습니다.", "warn"
            )
            return False
        return True

    async def _abort(self, msg: str) -> None:
        await self.presenter.emit_log(msg, "error")
        await self._abort_no_log()

    async def _abort_no_log(self) -> None:
        await self.issue._safe_ble_disconnect()   # BLE 안전 해제 (FlowBase 공용 헬퍼)
        self.session.reset()
        await self.presenter.emit_state(FlowState.IDLE)

    async def _mark_done(self, **extra) -> None:
        """성공 — DONE 으로 잠시 표시 후 IDLE."""
        await self.presenter.emit_state(FlowState.DONE, **extra)
        self.session.reset()
        await asyncio.sleep(DONE_LINGER_SECONDS)
        if self.session.flow is None:
            await self.presenter.emit_state(FlowState.IDLE)

    async def _safe(self, coro) -> None:
        """플로우 진입점에서 DomainError 잡아서 로그 + abort."""
        try:
            await coro
        except DomainError as e:
            await self._abort(str(e))
        except Exception as e:
            log.exception("flow")
            await self._abort(f"내부 오류: {e}")

    async def _safe_outcome(self, coro, default):
        try:
            return await coro
        except DomainError as e:
            await self.presenter.emit_log(str(e), "warn")
            return default
        except Exception as e:
            log.exception("flow outcome")
            await self.presenter.emit_log(f"내부 오류: {e}", "error")
            return default
