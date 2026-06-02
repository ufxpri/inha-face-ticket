import pytest

from faceticket.adapters.devices.split import SplitOperatorDevice
from faceticket.application.ports import ROLE_GATE, ROLE_NFC

pytestmark = pytest.mark.asyncio


class FakeOperatorDevice:
    """역할별 라우팅 검증용 — 어떤 명령이 자기에게 왔는지 기록."""

    def __init__(self) -> None:
        self._port = None
        self.calls: list[str] = []

    @property
    def is_connected(self) -> bool:
        return self._port is not None

    @property
    def port(self):
        return self._port

    async def connect(self, port: str) -> bool:
        self._port = port
        return True

    def disconnect(self) -> None:
        self._port = None

    async def wake_wristband(self) -> bool:
        self.calls.append("WAKE")
        return True

    async def wake_wristband_wait(self, *, timeout_s: float = 5.0) -> bool:
        self.calls.append("WAKE_WAIT")
        return True

    async def clear_wristband(self) -> bool:
        self.calls.append("CLEAR")
        return True

    async def signal_pass(self) -> bool:
        self.calls.append("PASS")
        return True

    async def signal_deny(self) -> bool:
        self.calls.append("DENY")
        return True


def make_split() -> tuple[SplitOperatorDevice, FakeOperatorDevice, FakeOperatorDevice]:
    nfc, gate = FakeOperatorDevice(), FakeOperatorDevice()
    return SplitOperatorDevice(nfc=nfc, gate=gate), nfc, gate


async def test_wake_wait_routes_to_nfc_device_only() -> None:
    dev, nfc, gate = make_split()
    assert await dev.wake_wristband_wait(timeout_s=1.0) is True
    assert nfc.calls == ["WAKE_WAIT"]
    assert gate.calls == []


async def test_nfc_commands_route_to_nfc_device_only() -> None:
    dev, nfc, gate = make_split()
    await dev.wake_wristband()
    await dev.clear_wristband()
    assert nfc.calls == ["WAKE", "CLEAR"]
    assert gate.calls == []


async def test_gate_commands_route_to_gate_device_only() -> None:
    dev, nfc, gate = make_split()
    await dev.signal_pass()
    await dev.signal_deny()
    assert gate.calls == ["PASS", "DENY"]
    assert nfc.calls == []


async def test_connect_role_targets_only_that_role() -> None:
    dev, nfc, gate = make_split()
    assert await dev.connect_role(ROLE_NFC, "COM_NFC") is True
    assert nfc.port == "COM_NFC"
    assert gate.port is None
    assert await dev.connect_role(ROLE_GATE, "COM_GATE") is True
    assert gate.port == "COM_GATE"


async def test_disconnect_role_targets_only_that_role() -> None:
    dev, nfc, gate = make_split()
    await dev.connect_role(ROLE_NFC, "COM_NFC")
    await dev.connect_role(ROLE_GATE, "COM_GATE")
    dev.disconnect_role(ROLE_GATE)
    assert nfc.is_connected is True
    assert gate.is_connected is False


async def test_is_connected_tracks_nfc_role() -> None:
    dev, _, _ = make_split()
    assert dev.is_connected is False
    await dev.connect_role(ROLE_GATE, "COM_GATE")
    assert dev.is_connected is False, "게이트만 연결돼선 절차 시작(is_connected)이 True 면 안 됨"
    await dev.connect_role(ROLE_NFC, "COM_NFC")
    assert dev.is_connected is True


async def test_status_snapshot_reports_both_roles() -> None:
    dev, _, _ = make_split()
    await dev.connect_role(ROLE_NFC, "COM_NFC")
    snap = dev.status_snapshot()
    assert snap[ROLE_NFC] == {"connected": True, "port": "COM_NFC"}
    assert snap[ROLE_GATE] == {"connected": False, "port": None}


async def test_unknown_role_raises() -> None:
    dev, _, _ = make_split()
    with pytest.raises(ValueError):
        await dev.connect_role("bogus", "COMX")


async def test_unified_connect_attaches_both_roles() -> None:
    dev, nfc, gate = make_split()
    assert await dev.connect("SIM") is True
    assert nfc.port == "SIM" and gate.port == "SIM"
    dev.disconnect()
    assert nfc.is_connected is False and gate.is_connected is False
