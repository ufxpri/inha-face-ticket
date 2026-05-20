"""DeviceRegistry — 두 장치 mutex 관리."""
from __future__ import annotations

from typing import Optional

from faceticket.application.ports import IOperatorDevice
from faceticket.application.ports.device_port import OperatorDeviceKey


class DeviceRegistry:
    """발급/입장 장치 중 한 번에 한쪽만 연결되도록 강제."""

    def __init__(self, issuance: IOperatorDevice, entry: IOperatorDevice) -> None:
        self.issuance = issuance
        self.entry = entry
        self._devices: dict[str, IOperatorDevice] = {"issuance": issuance, "entry": entry}

    def get(self, key: OperatorDeviceKey) -> Optional[IOperatorDevice]:
        return self._devices.get(key)

    @property
    def active(self) -> Optional[IOperatorDevice]:
        for d in self._devices.values():
            if d.is_connected:
                return d
        return None

    @property
    def active_key(self) -> Optional[OperatorDeviceKey]:
        for k, d in self._devices.items():
            if d.is_connected:
                return k                       # type: ignore[return-value]
        return None

    def other_connected(self, key: OperatorDeviceKey) -> bool:
        return any(k != key and d.is_connected for k, d in self._devices.items())

    async def connect(self, key: OperatorDeviceKey, port: str) -> tuple[bool, str]:
        dev = self._devices.get(key)
        if dev is None:
            return False, f"알 수 없는 장치: {key}"
        if dev.is_connected:
            return True, "이미 연결됨"
        if self.other_connected(key):
            return False, "다른 장치 사용 중 — 먼저 disconnect 후 시도"
        ok = await dev.connect(port)
        return ok, ("연결 성공" if ok else f"{port} 열기 실패")

    def disconnect(self, key: OperatorDeviceKey) -> tuple[bool, str]:
        dev = self._devices.get(key)
        if dev is None:
            return False, f"알 수 없는 장치: {key}"
        if not dev.is_connected:
            return True, "이미 해제됨"
        dev.disconnect()
        return True, "해제됨"

    def disconnect_all(self) -> None:
        for d in self._devices.values():
            try:
                d.disconnect()
            except Exception:
                pass

    def snapshot(self) -> dict:
        return {
            "issuance_status": {"connected": self.issuance.is_connected, "port": self.issuance.port},
            "entry_status":    {"connected": self.entry.is_connected,    "port": self.entry.port},
            "active":          self.active_key,
        }
