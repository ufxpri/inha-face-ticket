"""발급장치 — NFC 라이터 + 게이트 솔레노이드를 제어하는 아두이노 (USB Serial).

운영자가 발급 카운터에서 사용한다. 팔찌를 NFC 리더에 태그하면 광고 트리거를
write 하고, 게이트 OPEN/DENY 신호로 입장 검증 결과를 물리적으로 표시한다.

프로토콜 (아두이노 펌웨어와 일치)
    NFC_WRITE BLE_TRIGGER   → OK
    NFC_CLEAR               → OK
    GATE OPEN               → OK PASS (또는 통과 미감지 시 그 외)
    GATE DENY               → OK

설계
    - 내부 시리얼 객체는 캡슐화 (`_ser`)
    - 의도 기반 메서드명 (wake/signal_pass/signal_deny/clear_wristband)
    - 동일 시그니처를 `EntryDevice` 와 공유 → FlowController 는 substitutable.
"""
from __future__ import annotations

import asyncio
from typing import Optional

try:
    import serial as pyserial
    HAS_SER = True
except Exception:
    HAS_SER = False


class IssuanceDevice:
    """발급장치 — NFC + 게이트 제어 아두이노."""

    SIM_PORT = "SIM"

    def __init__(self, baud: int = 115200) -> None:
        self._ser: Optional["pyserial.Serial"] = None
        self._baud = baud
        self._port: Optional[str] = None
        self._sim: bool = False
        self._lock = asyncio.Lock()

    # ── 연결 라이프사이클 ────────────────────────────────────
    @property
    def is_connected(self) -> bool:
        return self._ser is not None or self._sim

    @property
    def port(self) -> Optional[str]:
        return self._port

    async def connect(self, port: str) -> bool:
        """시리얼 포트를 열어 발급장치에 연결. port=='SIM' 이면 가상 연결. 성공 시 True."""
        if self.is_connected:
            print(f"[ISSUANCE] 이미 연결됨 ({self._port})")
            return True
        if port == self.SIM_PORT:
            self._sim = True
            self._port = self.SIM_PORT
            print("[ISSUANCE] SIM 가상 연결")
            return True
        if not HAS_SER:
            print("[ISSUANCE] pyserial 미설치 — 연결 불가")
            return False
        try:
            loop = asyncio.get_running_loop()
            ser = await loop.run_in_executor(
                None, lambda: pyserial.Serial(port, self._baud, timeout=2)
            )
            self._ser = ser
            self._port = port
            print(f"[ISSUANCE] {port} @ {self._baud} 연결")
            return True
        except Exception as e:
            print(f"[ISSUANCE] {port} 열기 실패: {e}")
            self._ser = None
            self._port = None
            return False

    def disconnect(self) -> None:
        """포트 명시적 close — 누수 방지."""
        if self._sim:
            print("[ISSUANCE] SIM 해제")
            self._sim = False
            self._port = None
            return
        if self._ser is None:
            return
        try:
            self._ser.close()
        except Exception:
            pass
        print(f"[ISSUANCE] {self._port} 해제")
        self._ser = None
        self._port = None

    # ── 저수준 송수신 ────────────────────────────────────────
    def _sim_response(self, cmd: str) -> str:
        if cmd.startswith("GATE OPEN"):
            return "OK PASS"
        return "OK"   # NFC_WRITE / NFC_CLEAR / GATE DENY

    async def _send(self, line: str) -> str:
        if self._sim:
            await asyncio.sleep(0.2)        # 실제 NFC 동작 시간 흉내
            resp = self._sim_response(line.strip())
            print(f"[ISSUANCE-SIM] {line.strip()} → {resp}")
            return resp
        if self._ser is None:
            raise RuntimeError("ISSUANCE 미연결")
        async with self._lock:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(
                None, self._ser.write, (line + "\n").encode("ascii", "ignore")
            )
            raw = await loop.run_in_executor(None, self._ser.readline)
        return raw.decode("ascii", errors="replace").strip()

    # ── 의도 기반 명령 ────────────────────────────────────────
    async def wake_wristband(self) -> bool:
        """NFC 태그로 팔찌 BLE 광고를 깨운다."""
        if not self.is_connected:
            return False
        try:
            return (await self._send("NFC_WRITE BLE_TRIGGER")).startswith("OK")
        except Exception as e:
            print(f"[ISSUANCE] wake_wristband 오류: {e}")
            return False

    async def signal_pass(self) -> bool:
        """통과 신호 — 게이트 OPEN."""
        if not self.is_connected:
            return False
        try:
            resp = await self._send("GATE OPEN")
            print(f"[ISSUANCE] signal_pass 응답: {resp}")
            return resp.startswith("OK PASS")
        except Exception as e:
            print(f"[ISSUANCE] signal_pass 오류: {e}")
            return False

    async def signal_deny(self) -> bool:
        """거부 신호 — 게이트 DENY."""
        if not self.is_connected:
            return False
        try:
            return (await self._send("GATE DENY")).startswith("OK")
        except Exception as e:
            print(f"[ISSUANCE] signal_deny 오류: {e}")
            return False

    async def clear_wristband(self) -> bool:
        """NFC 태그 클리어 (반납 시)."""
        if not self.is_connected:
            return False
        try:
            return (await self._send("NFC_CLEAR")).startswith("OK")
        except Exception as e:
            print(f"[ISSUANCE] clear_wristband 오류: {e}")
            return False
