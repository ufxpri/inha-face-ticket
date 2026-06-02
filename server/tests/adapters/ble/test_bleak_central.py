import pytest

from faceticket.adapters.ble.bleak_central import BleakBleCentral
from faceticket.config import CHR_FLAG

pytestmark = pytest.mark.asyncio


class FailingGattClient:
    def __init__(self) -> None:
        self.read_uuids: list[str] = []

    async def read_gatt_char(self, uuid: str) -> bytes:
        self.read_uuids.append(uuid)
        raise RuntimeError("gatt read failed")


async def test_read_contact_flag_fails_closed_when_gatt_read_fails() -> None:
    central = object.__new__(BleakBleCentral)
    central.client = FailingGattClient()

    flag_broken = await central.read_contact_flag()

    assert flag_broken is True
    assert central.client.read_uuids == [CHR_FLAG]
