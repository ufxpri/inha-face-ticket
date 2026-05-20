"""DeviceRegistry — 발급장치 / 입장장치 두 인스턴스를 보유하고 동시에
오직 한쪽만 연결되도록 mutex 를 강제한다. FlowController 는 `active` 만 통해
일관 인터페이스로 호출하므로 어느 쪽이 연결돼 있는지 알 필요가 없다 (LSP+DIP).

OOP 원칙
    SRP — 연결 mutex 와 포트 검색만 담당. 비즈니스 로직은 FlowController.
    OCP — 새 장치 종류 추가 시 self._devices 에 등록만 하면 됨.
    DIP — 외부에는 OperatorDevice Protocol 만 노출.
"""
from __future__ import annotations

from typing import Optional, Protocol, runtime_checkable


@runtime_checkable
class OperatorDevice(Protocol):
    """발급/입장 장치가 공통으로 만족해야 하는 계약 (duck typing)."""

    @property
    def is_connected(self) -> bool: ...
    @property
    def port(self) -> Optional[str]: ...

    async def connect(self, port: str) -> bool: ...
    def disconnect(self) -> None: ...
    async def wake_wristband(self) -> bool: ...
    async def signal_pass(self) -> bool: ...
    async def signal_deny(self) -> bool: ...
    async def clear_wristband(self) -> bool: ...


class DeviceRegistry:
    """두 장치 mutex 관리. 동시에 한쪽만 연결 가능."""

    def __init__(self, issuance: OperatorDevice, entry: OperatorDevice) -> None:
        self.issuance = issuance
        self.entry = entry
        self._devices = {"issuance": issuance, "entry": entry}

    def get(self, key: str) -> Optional[OperatorDevice]:
        return self._devices.get(key)

    @property
    def active(self) -> Optional[OperatorDevice]:
        """연결된 장치 반환. 둘 다 미연결이면 None.

        FlowController 는 이걸 통해 어느 쪽이 연결됐는지 모른 채 동작한다.
        """
        for d in self._devices.values():
            if d.is_connected:
                return d
        return None

    @property
    def active_key(self) -> Optional[str]:
        for k, d in self._devices.items():
            if d.is_connected:
                return k
        return None

    def other_connected(self, key: str) -> bool:
        """`key` 가 아닌 다른 장치가 이미 연결돼 있는지."""
        for k, d in self._devices.items():
            if k != key and d.is_connected:
                return True
        return False

    async def connect(self, key: str, port: str) -> tuple[bool, str]:
        """장치 연결 시도. mutex 위반 시 (False, reason)."""
        dev = self._devices.get(key)
        if dev is None:
            return False, f"알 수 없는 장치: {key}"
        if dev.is_connected:
            return True, "이미 연결됨"
        if self.other_connected(key):
            return False, "다른 장치 사용 중 — 먼저 disconnect 후 시도"
        ok = await dev.connect(port)
        return ok, ("연결 성공" if ok else f"{port} 열기 실패")

    def disconnect(self, key: str) -> tuple[bool, str]:
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
        """admin 으로 broadcast 할 상태 묶음."""
        return {
            "issuance_status": {
                "connected": self.issuance.is_connected,
                "port": self.issuance.port,
            },
            "entry_status": {
                "connected": self.entry.is_connected,
                "port": self.entry.port,
            },
            "active": self.active_key,
        }


# ── 포트 검색 유틸 (SRP — 별도 함수) ──────────────────────────
def list_serial_ports() -> list[dict]:
    """`serial.tools.list_ports.comports()` 결과를 직렬화."""
    try:
        from serial.tools import list_ports
    except Exception:
        return []
    out: list[dict] = []
    for p in list_ports.comports():
        vid_pid = ""
        try:
            if p.vid is not None and p.pid is not None:
                vid_pid = f"{p.vid:04X}:{p.pid:04X}"
        except Exception:
            pass
        out.append({
            "device": p.device,
            "description": p.description or "",
            "vid_pid": vid_pid,
        })
    return out
