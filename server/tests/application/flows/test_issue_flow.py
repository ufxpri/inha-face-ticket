import numpy as np
import pytest

from faceticket.adapters.ble.mock_central import MockBleCentral
from faceticket.adapters.devices.operator import OperatorDevice
from faceticket.application.flows.issuance import IssueFlow
from faceticket.application.ports import IssueRecord
from faceticket.config import EMBED_DIM, LED_ISSUED
from faceticket.domain.embedding import l2_normalize
from faceticket.domain.errors import (
    ActiveIssueConflictError,
    MissingDeviceError,
    MissingEmbeddingError,
)
from faceticket.domain.session import Session
from faceticket.domain.states import Flow, FlowState

pytestmark = pytest.mark.asyncio


def embedding() -> np.ndarray:
    return l2_normalize(np.ones(EMBED_DIM, dtype=np.float32))


class InMemoryIssueRepository:
    def __init__(self) -> None:
        self.records: list[tuple[str, str, str]] = []

    def record_issue(self, wristband_id: str, seat: str, name: str = "") -> int:
        active_wristband = self.find_active_by_wristband(wristband_id)
        if active_wristband is not None:
            raise ActiveIssueConflictError("active wristband duplicate")

        active_seat = self.find_active_by_seat(seat)
        if active_seat is not None:
            raise ActiveIssueConflictError("active seat duplicate")

        self.records.append((wristband_id, seat, name))
        return len(self.records)

    def record_return(self, wristband_id: str) -> bool:
        return False

    def list_active(self) -> list[dict]:
        return [
            {"id": i, "wristband_id": wid, "seat": seat, "name": name}
            for i, (wid, seat, name) in enumerate(self.records, start=1)
        ]

    def find_active_by_wristband(self, wristband_id: str) -> IssueRecord | None:
        for i, (wid, seat, name) in enumerate(self.records, start=1):
            if wid == wristband_id:
                return IssueRecord(i, wid, seat, name, "now")
        return None

    def find_active_by_seat(self, seat: str) -> IssueRecord | None:
        for i, (wid, active_seat, name) in enumerate(self.records, start=1):
            if active_seat == seat:
                return IssueRecord(i, wid, active_seat, name, "now")
        return None

    def close(self) -> None:
        pass


class RecordingPresenter:
    def __init__(self) -> None:
        self.states: list[tuple[FlowState, dict]] = []
        self.logs: list[tuple[str, str]] = []
        self.capture_requests: list[tuple[Flow, dict]] = []
        self.capture_results: list[tuple[bool, str, object]] = []
        self.embedding_snapshots: list[tuple[object, str]] = []
        self.completions: list[tuple[bool, str, dict]] = []
        self.active_lists: list[list[dict]] = []
        self.flags: list[dict] = []

    async def emit_state(self, state: FlowState, **extra) -> None:
        self.states.append((state, extra))

    async def emit_log(self, msg: str, level: str = "info") -> None:
        self.logs.append((level, msg))

    async def request_capture(self, flow: Flow, *, seat: str = "") -> None:
        self.capture_requests.append((flow, {"seat": seat}))

    async def emit_capture_result(self, ok: bool, msg: str, embedding=None) -> None:
        self.capture_results.append((ok, msg, embedding))

    async def emit_embedding_snapshot(self, embedding, captured_at: str) -> None:
        self.embedding_snapshots.append((embedding, captured_at))

    async def emit_complete(self, ok: bool, msg: str, **extra) -> None:
        self.completions.append((ok, msg, extra))

    async def emit_active_list(self, items: list[dict]) -> None:
        self.active_lists.append(items)

    async def emit_flags(self, snapshot: dict) -> None:
        self.flags.append(snapshot)


class FakeOperatorDevice:
    def __init__(self, *, connected: bool = True, wake_ok: bool = True) -> None:
        self.connected = connected
        self.wake_ok = wake_ok
        self.wake_calls = 0

    @property
    def is_connected(self) -> bool:
        return self.connected

    @property
    def port(self) -> str | None:
        return "FAKE" if self.connected else None

    async def connect(self, port: str) -> bool:
        self.connected = True
        return True

    def disconnect(self) -> None:
        self.connected = False

    async def wake_wristband(self) -> bool:
        self.wake_calls += 1
        return self.wake_ok

    async def signal_pass(self) -> bool:
        return True

    async def signal_deny(self) -> bool:
        return True

    async def clear_wristband(self) -> bool:
        return True


class ControlledBleCentral:
    def __init__(self, *, connect_ok: bool = True, write_embedding_ok: bool = True) -> None:
        self.connect_ok = connect_ok
        self.write_embedding_ok = write_embedding_ok
        self.connect_calls = 0
        self.disconnect_calls = 0
        self.written_embedding = None
        self.written_seat = ""
        self.led_codes: list[int] = []
        self.wristband_id = "WB-TEST"

    async def connect_wristband(self, timeout: float = 15.0) -> bool:
        self.connect_calls += 1
        return self.connect_ok

    async def disconnect(self) -> None:
        self.disconnect_calls += 1

    async def write_embedding(self, embedding) -> bool:
        if self.write_embedding_ok:
            self.written_embedding = np.asarray(embedding, dtype=np.float32).copy()
        return self.write_embedding_ok

    async def read_embedding(self):
        return self.written_embedding

    async def write_seat(self, seat: str) -> bool:
        self.written_seat = seat
        return True

    async def read_contact_flag(self) -> bool:
        return False

    async def read_wristband_id(self) -> str:
        return self.wristband_id

    async def write_led_effect(self, code: int) -> bool:
        self.led_codes.append(code)
        return True

    async def clear_wristband(self) -> bool:
        self.written_embedding = None
        self.written_seat = ""
        return True


def make_flow(
    *,
    device=None,
    ble=None,
    repo=None,
    presenter=None,
    session=None,
) -> tuple[IssueFlow, InMemoryIssueRepository, RecordingPresenter, Session]:
    repo = repo or InMemoryIssueRepository()
    presenter = presenter or RecordingPresenter()
    session = session or Session()
    flow = IssueFlow(
        repo=repo,
        ble=ble or ControlledBleCentral(),
        device=device or FakeOperatorDevice(),
        session=session,
        presenter=presenter,
    )
    return flow, repo, presenter, session


async def test_start_requires_connected_operator_device() -> None:
    flow, _, _, _ = make_flow(device=FakeOperatorDevice(connected=False))

    with pytest.raises(MissingDeviceError):
        await flow.start("A-01", "Kim")


async def test_start_requests_face_capture_and_sets_issue_session() -> None:
    flow, _, presenter, session = make_flow()

    await flow.start("A-01", "Kim")

    assert session.flow == Flow.ISSUE
    assert session.seat == "A-01"
    assert session.name == "Kim"
    assert presenter.states == [(FlowState.AWAIT_FACE, {})]
    assert presenter.capture_requests == [(Flow.ISSUE, {"seat": "A-01"})]


async def test_face_capture_moves_issue_flow_to_await_tag() -> None:
    flow, _, presenter, session = make_flow()
    emb = embedding()

    await flow.start("A-01", "Kim")
    await flow.on_face_captured(emb)

    assert np.allclose(session.embedding, emb)
    assert presenter.states[-1] == (FlowState.AWAIT_TAG, {})


async def test_tag_with_sim_operator_and_mock_ble_records_issue() -> None:
    device = OperatorDevice()
    repo = InMemoryIssueRepository()
    presenter = RecordingPresenter()
    session = Session()
    ble = MockBleCentral()
    flow = IssueFlow(
        repo=repo,
        ble=ble,
        device=device,
        session=session,
        presenter=presenter,
    )
    emb = embedding()

    try:
        assert await device.connect("SIM")
        await flow.start("DEMO-A1", "Demo User")
        await flow.on_face_captured(emb)

        outcome = await flow.on_tag()
        stored_embedding = await ble.read_embedding()
        wristband_id = await ble.read_wristband_id()
    finally:
        device.disconnect()

    assert outcome.ok is True
    assert outcome.issue_id == 1
    assert outcome.seat == "DEMO-A1"
    assert outcome.wristband_id == wristband_id
    assert repo.records == [(wristband_id, "DEMO-A1", "Demo User")]
    assert np.allclose(stored_embedding, emb)


async def test_tag_requires_captured_embedding() -> None:
    flow, _, _, _ = make_flow()

    with pytest.raises(MissingEmbeddingError):
        await flow.on_tag()


async def test_tag_returns_failure_when_wake_fails() -> None:
    device = FakeOperatorDevice(wake_ok=False)
    ble = ControlledBleCentral()
    flow, repo, _, _ = make_flow(device=device, ble=ble)

    await flow.start("A-01", "Kim")
    await flow.on_face_captured(embedding())
    outcome = await flow.on_tag()

    assert outcome.ok is False
    assert outcome.reason == "wake 실패 — 장치 상태를 확인하세요."
    assert device.wake_calls == 1
    assert ble.connect_calls == 0
    assert repo.records == []


async def test_tag_returns_failure_when_ble_connection_fails() -> None:
    ble = ControlledBleCentral(connect_ok=False)
    flow, repo, _, _ = make_flow(ble=ble)

    await flow.start("A-01", "Kim")
    await flow.on_face_captured(embedding())
    outcome = await flow.on_tag()

    assert outcome.ok is False
    assert outcome.reason == "BLE 연결 실패"
    assert ble.connect_calls == 1
    assert ble.disconnect_calls == 1
    assert repo.records == []


async def test_tag_returns_failure_when_embedding_write_fails() -> None:
    ble = ControlledBleCentral(write_embedding_ok=False)
    flow, repo, _, _ = make_flow(ble=ble)

    await flow.start("A-01", "Kim")
    await flow.on_face_captured(embedding())
    outcome = await flow.on_tag()

    assert outcome.ok is False
    assert outcome.reason == "임베딩 write 실패"
    assert ble.written_seat == ""
    assert ble.led_codes == []
    assert repo.records == []


async def test_tag_rejects_active_wristband_before_ble_write() -> None:
    repo = InMemoryIssueRepository()
    repo.records.append(("WB-TEST", "A-99", "Existing User"))
    ble = ControlledBleCentral()
    flow, _, _, _ = make_flow(ble=ble, repo=repo)

    await flow.start("A-01", "Kim")
    await flow.on_face_captured(embedding())
    outcome = await flow.on_tag()

    assert outcome.ok is False
    assert "이미 발급 중인 팔찌" in (outcome.reason or "")
    assert ble.written_embedding is None
    assert ble.written_seat == ""
    assert ble.led_codes == []
    assert repo.records == [("WB-TEST", "A-99", "Existing User")]


async def test_tag_rejects_active_seat_before_ble_write() -> None:
    repo = InMemoryIssueRepository()
    repo.records.append(("WB-OTHER", "A-01", "Existing User"))
    ble = ControlledBleCentral()
    ble.wristband_id = "WB-NEW"
    flow, _, _, _ = make_flow(ble=ble, repo=repo)

    await flow.start("A-01", "Kim")
    await flow.on_face_captured(embedding())
    outcome = await flow.on_tag()

    assert outcome.ok is False
    assert "이미 발급 중인 좌석" in (outcome.reason or "")
    assert ble.written_embedding is None
    assert ble.written_seat == ""
    assert ble.led_codes == []
    assert repo.records == [("WB-OTHER", "A-01", "Existing User")]


async def test_successful_tag_writes_seat_records_issue_and_sets_led() -> None:
    ble = ControlledBleCentral()
    flow, repo, _, _ = make_flow(ble=ble)
    emb = embedding()

    await flow.start("A-01", "Kim")
    await flow.on_face_captured(emb)
    outcome = await flow.on_tag()

    assert outcome.ok is True
    assert outcome.wristband_id == "WB-TEST"
    assert outcome.seat == "A-01"
    assert outcome.issue_id == 1
    assert np.allclose(ble.written_embedding, emb)
    assert ble.written_seat == "A-01"
    assert ble.led_codes == [LED_ISSUED]
    assert repo.records == [("WB-TEST", "A-01", "Kim")]
