"""Container — 명시적 컴포지션 루트.

기존 main.py:433-443 에 흩어져 있던 모듈-수준 전역 변수들을 한 dataclass 로 묶었다.
- 의존성 그래프가 한 함수 안에서 보임 → 테스트에서 한 줄로 override.
- import 순서나 모듈-수준 부작용에 의존하지 않음.
- 새 백엔드/구현체를 추가할 땐 `build_container` 한 곳만 수정.
"""
from __future__ import annotations

from dataclasses import dataclass

from faceticket.adapters.ble import BleSwap, make_ble_swap
from faceticket.adapters.devices import DeviceRegistry, EntryDevice, IssuanceDevice
from faceticket.adapters.face import make_recognizer
from faceticket.adapters.persistence import SqliteIssueRepository
from faceticket.adapters.web.client_pool import ClientPool
from faceticket.adapters.web.presenter import WebSocketPresenter
from faceticket.application.device_service import DeviceService
from faceticket.application.flow_runner import FlowRunner
from faceticket.application.flows import EntryFlow, IssueFlow, ReturnFlow
from faceticket.application.ports import IFaceRecognizer, IIssueRepository, IPresenter
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
    issuance: IssuanceDevice
    entry: EntryDevice
    registry: DeviceRegistry
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
    """의존성 그래프를 한 함수 안에서 빌드.

    아래 변수 도입 순서가 사실상 위상 정렬이라, 새 의존성 추가 시 위치만 신경쓰면 됨.
    """
    # ── 도메인 ────────────────────────────────────────────────
    session = Session()

    # ── 어댑터 (I/O) ─────────────────────────────────────────
    face = make_recognizer(settings)
    ble = make_ble_swap(settings)
    repo = SqliteIssueRepository(DB_PATH)
    issuance = IssuanceDevice(baud=settings.serial_baud)
    entry = EntryDevice(baud=settings.serial_baud)
    registry = DeviceRegistry(issuance, entry)
    admins = ClientPool()
    tablets = ClientPool()
    presenter = WebSocketPresenter(admins=admins, tablets=tablets)

    # ── 유스케이스 ────────────────────────────────────────────
    common = dict(ble=ble, devices=registry, session=session, presenter=presenter)
    issue_flow = IssueFlow(repo=repo, **common)
    entry_flow = EntryFlow(**common)
    return_flow = ReturnFlow(repo=repo, **common)
    flow_runner = FlowRunner(
        issue=issue_flow, entry=entry_flow, return_=return_flow,
        session=session, repo=repo, presenter=presenter,
    )
    toggles = ToggleService(
        face=face, ble_swap=ble, registry=registry,
        session=session, presenter=presenter,
        tablet_count_provider=lambda: len(tablets),
    )
    device_service = DeviceService(
        registry=registry, session=session, presenter=presenter,
        flags_emitter=toggles.broadcast_flags,
    )

    return Container(
        settings=settings, session=session,
        face=face, ble=ble, repo=repo,
        issuance=issuance, entry=entry, registry=registry,
        admins=admins, tablets=tablets, presenter=presenter,
        issue_flow=issue_flow, entry_flow=entry_flow, return_flow=return_flow,
        flow_runner=flow_runner, toggles=toggles, device_service=device_service,
    )
