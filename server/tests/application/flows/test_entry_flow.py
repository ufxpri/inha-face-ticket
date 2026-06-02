import numpy as np
import pytest

from faceticket.application.flows.entry import EntryFlow
from faceticket.config import EMBED_DIM, LED_FAILURE, LED_SUCCESS
from faceticket.domain.embedding import l2_normalize
from faceticket.domain.errors import MissingDeviceError
from faceticket.domain.session import Session
from faceticket.domain.states import Flow, FlowState

pytestmark = pytest.mark.asyncio

_DEFAULT_EMBEDDING = object()


def embedding(value: float = 1.0) -> np.ndarray:
    return l2_normalize(np.full(EMBED_DIM, value, dtype=np.float32))


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
    def __init__(
        self,
        *,
        connected: bool = True,
        wake_ok: bool = True,
        pass_ok: bool = True,
    ) -> None:
        self.connected = connected
        self.wake_ok = wake_ok
        self.pass_ok = pass_ok
        self.wake_calls = 0
        self.pass_calls = 0
        self.deny_calls = 0

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
        self.pass_calls += 1
        return self.pass_ok

    async def signal_deny(self) -> bool:
        self.deny_calls += 1
        return True

    async def clear_wristband(self) -> bool:
        return True


class ControlledBleCentral:
    def __init__(
        self,
        *,
        connect_ok: bool = True,
        stored_embedding=_DEFAULT_EMBEDDING,
        contact_flag: bool = False,
        contact_flag_error: Exception | None = None,
    ) -> None:
        self.connect_ok = connect_ok
        self.stored_embedding = (
            embedding() if stored_embedding is _DEFAULT_EMBEDDING else stored_embedding
        )
        self.contact_flag = contact_flag
        self.contact_flag_error = contact_flag_error
        self.connect_calls = 0
        self.disconnect_calls = 0
        self.read_embedding_calls = 0
        self.read_flag_calls = 0
        self.led_codes: list[int] = []

    async def connect_wristband(self, timeout: float = 15.0) -> bool:
        self.connect_calls += 1
        return self.connect_ok

    async def disconnect(self) -> None:
        self.disconnect_calls += 1

    async def write_embedding(self, embedding) -> bool:
        self.stored_embedding = np.asarray(embedding, dtype=np.float32).copy()
        return True

    async def read_embedding(self):
        self.read_embedding_calls += 1
        if self.stored_embedding is None:
            return None
        return np.asarray(self.stored_embedding, dtype=np.float32).copy()

    async def write_seat(self, seat: str) -> bool:
        return True

    async def read_contact_flag(self) -> bool:
        self.read_flag_calls += 1
        if self.contact_flag_error is not None:
            raise self.contact_flag_error
        return self.contact_flag

    async def read_wristband_id(self) -> str:
        return "WB-ENTRY"

    async def write_led_effect(self, code: int) -> bool:
        self.led_codes.append(code)
        return True

    async def clear_wristband(self) -> bool:
        self.stored_embedding = np.zeros(EMBED_DIM, dtype=np.float32)
        return True


def make_flow(
    *,
    device=None,
    ble=None,
    presenter=None,
    session=None,
) -> tuple[EntryFlow, FakeOperatorDevice, ControlledBleCentral, RecordingPresenter, Session]:
    device = device or FakeOperatorDevice()
    ble = ble or ControlledBleCentral()
    presenter = presenter or RecordingPresenter()
    session = session or Session()
    flow = EntryFlow(
        ble=ble,
        device=device,
        session=session,
        presenter=presenter,
    )
    return flow, device, ble, presenter, session


async def test_start_requires_connected_operator_device() -> None:
    flow, _, _, _, _ = make_flow(device=FakeOperatorDevice(connected=False))

    with pytest.raises(MissingDeviceError):
        await flow.start()


async def test_start_sets_entry_session_and_awaits_tag() -> None:
    flow, _, _, presenter, session = make_flow()

    await flow.start()

    assert session.flow == Flow.ENTRY
    assert presenter.states == [(FlowState.AWAIT_TAG, {})]


async def test_tag_reads_embedding_and_requests_entry_capture() -> None:
    stored = embedding()
    flow, device, ble, presenter, session = make_flow(
        ble=ControlledBleCentral(stored_embedding=stored)
    )

    await flow.start()
    result = await flow.on_tag()

    assert result.ok is True
    assert device.wake_calls == 1
    assert ble.connect_calls == 1
    assert ble.read_embedding_calls == 1
    assert ble.read_flag_calls == 1
    assert np.allclose(session.embedding, stored)
    assert presenter.states[-1] == (FlowState.AWAIT_FACE_ENTRY, {})
    assert presenter.capture_requests == [(Flow.ENTRY, {"seat": ""})]


async def test_tag_returns_failure_when_wake_fails() -> None:
    flow, device, ble, _, _ = make_flow(device=FakeOperatorDevice(wake_ok=False))

    await flow.start()
    result = await flow.on_tag()

    assert result.ok is False
    assert result.reason == "wake 실패"
    assert device.wake_calls == 1
    assert ble.connect_calls == 0


async def test_tag_returns_failure_when_ble_connection_fails() -> None:
    flow, _, ble, _, _ = make_flow(ble=ControlledBleCentral(connect_ok=False))

    await flow.start()
    result = await flow.on_tag()

    assert result.ok is False
    assert result.reason == "BLE 연결 실패"
    assert ble.connect_calls == 1
    assert ble.read_embedding_calls == 0


async def test_tag_returns_failure_when_embedding_read_fails() -> None:
    flow, _, ble, _, _ = make_flow(ble=ControlledBleCentral(stored_embedding=None))

    await flow.start()
    result = await flow.on_tag()

    assert result.ok is False
    assert result.reason == "임베딩 read 실패"
    assert ble.led_codes == []


async def test_tag_denies_when_contact_flag_is_set() -> None:
    flow, device, ble, _, _ = make_flow(ble=ControlledBleCentral(contact_flag=True))

    await flow.start()
    result = await flow.on_tag()

    assert result.ok is False
    assert result.reason == "⚠ 체결 플래그 = 1 (중간 분리 감지) — 입장 거부"
    assert device.deny_calls == 1
    assert ble.led_codes == [LED_FAILURE]


async def test_tag_fails_closed_when_contact_flag_read_raises() -> None:
    session = Session()
    flow, device, ble, presenter, _ = make_flow(
        ble=ControlledBleCentral(contact_flag_error=RuntimeError("flag read failed")),
        session=session,
    )

    await flow.start()
    result = await flow.on_tag()

    assert result.ok is False
    assert "flag read failed" in (result.reason or "")
    assert session.embedding is None
    assert presenter.capture_requests == []
    assert device.pass_calls == 0
    assert ble.disconnect_calls == 1


async def test_tag_rejects_zero_embedding_as_unissued_wristband() -> None:
    flow, device, ble, _, _ = make_flow(
        ble=ControlledBleCentral(stored_embedding=np.zeros(EMBED_DIM, dtype=np.float32))
    )

    await flow.start()
    result = await flow.on_tag()

    assert result.ok is False
    assert result.reason == "⚠ 팔찌에 임베딩이 없습니다 (미발급)"
    assert device.deny_calls == 0
    assert ble.led_codes == [LED_FAILURE]


async def test_matching_face_signals_pass_and_success_led() -> None:
    stored = embedding()
    flow, device, ble, _, session = make_flow(ble=ControlledBleCentral(stored_embedding=stored))
    session.embedding = stored

    result = await flow.on_face_captured(stored)

    assert result.passed is True
    assert result.message == "통과"
    assert result.similarity == pytest.approx(1.0)
    assert device.pass_calls == 1
    assert device.deny_calls == 0
    assert ble.led_codes == [LED_SUCCESS]
    assert ble.disconnect_calls == 1


async def test_failed_gate_pass_marks_failure_led() -> None:
    stored = embedding()
    flow, device, ble, _, session = make_flow(
        device=FakeOperatorDevice(pass_ok=False),
        ble=ControlledBleCentral(stored_embedding=stored),
    )
    session.embedding = stored

    result = await flow.on_face_captured(stored)

    assert result.passed is False
    assert result.message == "게이트 통과 미감지"
    assert device.pass_calls == 1
    assert ble.led_codes == [LED_FAILURE]
    assert ble.disconnect_calls == 1


async def test_mismatched_face_signals_deny_and_failure_led() -> None:
    stored = embedding(1.0)
    live = embedding(-1.0)
    flow, device, ble, _, session = make_flow(ble=ControlledBleCentral(stored_embedding=stored))
    session.embedding = stored

    result = await flow.on_face_captured(live)

    assert result.passed is False
    assert result.message == "인증 실패"
    assert result.similarity < 0.55
    assert device.pass_calls == 0
    assert device.deny_calls == 1
    assert ble.led_codes == [LED_FAILURE]
    assert ble.disconnect_calls == 1


async def test_face_capture_without_stored_embedding_returns_state_error() -> None:
    flow, device, ble, _, _ = make_flow()

    result = await flow.on_face_captured(embedding())

    assert result.passed is False
    assert result.similarity == 0.0
    assert result.message == "내부 상태 오류 — 저장 임베딩 없음"
    assert device.pass_calls == 0
    assert device.deny_calls == 0
    assert ble.disconnect_calls == 0
