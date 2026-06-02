import pytest

from faceticket.adapters.devices.operator import OperatorDevice
from faceticket.adapters.devices.split import SplitOperatorDevice
from faceticket.application.device_service import DeviceService
from faceticket.application.ports import ROLE_GATE, ROLE_NFC
from faceticket.domain.session import Session

pytestmark = pytest.mark.asyncio


class RecordingPresenter:
    def __init__(self) -> None:
        self.logs: list[tuple[str, str]] = []

    async def emit_log(self, msg: str, level: str = "info") -> None:
        self.logs.append((level, msg))

    # device_service 는 emit_log 만 사용하지만 IPresenter 형상 유지용 no-op 들.
    async def emit_state(self, *a, **k): ...
    async def emit_flags(self, *a, **k): ...


def make_service():
    device = SplitOperatorDevice(nfc=OperatorDevice(), gate=OperatorDevice())
    session = Session()
    presenter = RecordingPresenter()
    flags = {"n": 0}

    async def emit_flags():
        flags["n"] += 1

    svc = DeviceService(
        device=device, session=session, presenter=presenter, flags_emitter=emit_flags,
    )
    return svc, device, session, flags


async def test_connect_routes_to_requested_role_via_sim() -> None:
    svc, device, _, flags = make_service()
    await svc.connect("SIM", ROLE_GATE)
    snap = device.status_snapshot()
    assert snap[ROLE_GATE]["connected"] is True
    assert snap[ROLE_NFC]["connected"] is False
    assert flags["n"] == 1


async def test_connect_rejected_while_session_busy() -> None:
    from faceticket.domain.states import Flow

    svc, device, session, _ = make_service()
    session.start(Flow.ENTRY)
    await svc.connect("SIM", ROLE_NFC)
    assert device.status_snapshot()[ROLE_NFC]["connected"] is False


async def test_disconnect_only_affects_target_role() -> None:
    svc, device, _, _ = make_service()
    await svc.connect("SIM", ROLE_NFC)
    await svc.connect("SIM", ROLE_GATE)
    await svc.disconnect(ROLE_GATE)
    snap = device.status_snapshot()
    assert snap[ROLE_NFC]["connected"] is True
    assert snap[ROLE_GATE]["connected"] is False


async def test_unknown_role_is_rejected() -> None:
    svc, device, _, _ = make_service()
    await svc.connect("SIM", "bogus")
    assert device.status_snapshot()[ROLE_NFC]["connected"] is False
