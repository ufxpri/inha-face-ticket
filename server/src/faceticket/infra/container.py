"""Container — 명시적 컴포지션 루트.

단일 OperatorDevice 모델: 발급/입장 두 인스턴스 + DeviceRegistry mutex 제거됨. 어떤 하드웨어
(NFC+게이트 Arduino, 또는 ESP32-C3 USB-CDC 직결) 든 동일한 WAKE/PASS/DENY/CLEAR/PING
프로토콜 사용.
"""
from __future__ import annotations

from dataclasses import dataclass

from faceticket.adapters.ble import BleSwap, make_ble_swap
from faceticket.adapters.devices import OperatorDevice
from faceticket.adapters.face import make_recognizer
from faceticket.adapters.persistence import SqliteIssueRepository
from faceticket.adapters.web.client_pool import ClientPool
from faceticket.adapters.web.presenter import WebSocketPresenter
from faceticket.application.device_service import DeviceService
from faceticket.application.flow_runner import FlowRunner
from faceticket.application.flows import EntryFlow, IssueFlow, ReturnFlow
from faceticket.application.ports import (
    IFaceRecognizer, IIssueRepository, IOperatorDevice, IPresenter,
)
from faceticket.application.toggle_service import ToggleService
from faceticket.config import DB_PATH, Settings
from faceticket.domain.session import Session


@dataclass
class Container:
    """모든 싱글톤의 단일 소유자. FastAPI app.state.container 로 노출."""

    settings: Settings
    session: Session
    face: IFaceRecognizer
    ble: BleSwap
    repo: IIssueRepository
    device: IOperatorDevice
    admins: ClientPool
    tablets: ClientPool
    presenter: IPresenter
    issue_flow: IssueFlow
    entry_flow: EntryFlow
    return_flow: ReturnFlow
    flow_runner: FlowRunner
    toggles: ToggleService
    device_service: DeviceService


def build_container(settings: Settings) -> Container:
    """의존성 그래프를 한 함수 안에서 빌드."""
    # ── 도메인 ────────────────────────────────────────────────
    session = Session()

    # ── 어댑터 (I/O) ─────────────────────────────────────────
    face = make_recognizer(settings)
    ble = make_ble_swap(settings)
    repo = SqliteIssueRepository(DB_PATH)
    device = OperatorDevice(baud=settings.serial_baud)
    admins = ClientPool()
    tablets = ClientPool()
    presenter = WebSocketPresenter(admins=admins, tablets=tablets)

    # ── 유스케이스 ────────────────────────────────────────────
    common = dict(ble=ble, device=device, session=session, presenter=presenter)
    issue_flow = IssueFlow(repo=repo, **common)
    entry_flow = EntryFlow(**common)
    return_flow = ReturnFlow(repo=repo, **common)
    flow_runner = FlowRunner(
        issue=issue_flow, entry=entry_flow, return_=return_flow,
        session=session, repo=repo, presenter=presenter,
    )
    toggles = ToggleService(
        face=face, ble_swap=ble, device=device,
        session=session, presenter=presenter,
        tablet_count_provider=lambda: len(tablets),
    )
    device_service = DeviceService(
        device=device, session=session, presenter=presenter,
        flags_emitter=toggles.broadcast_flags,
    )

    return Container(
        settings=settings, session=session,
        face=face, ble=ble, repo=repo,
        device=device,
        admins=admins, tablets=tablets, presenter=presenter,
        issue_flow=issue_flow, entry_flow=entry_flow, return_flow=return_flow,
        flow_runner=flow_runner, toggles=toggles, device_service=device_service,
    )
