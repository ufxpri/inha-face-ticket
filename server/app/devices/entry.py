"""입장장치 — ESP32-C3 팔찌에 USB-CDC 로 직결.

발급장치(NFC 라이터+게이트 아두이노) 대신 팔찌 자체에 USB 케이블을 직접 꽂아
명령을 보낸다. NFC 트리거가 필요 없고 (이미 BLE 광고 중) LED/OLED 효과로
PASS/DENY 를 표시한다. 게이트 솔레노이드는 없으므로 signal_pass 는 LED
SUCCESS 표시만 의미하지만, FlowController 입장에선 동일 시그니처라 신경쓰지 않는다.

프로토콜 (firmware-wristband/src/main.cpp 와 일치)
    WAKE\\n   → OK
    PASS\\n   → OK
    DENY\\n   → OK
    CLEAR\\n  → OK
    PING\\n   → OK PONG

주의
    USB-CDC 포트는 PlatformIO `pio device monitor` 와 동시에 점유 불가.
    펌웨어를 모니터링 중이면 모니터를 먼저 종료할 것.
"""
from __future__ import annotations

import asyncio
from typing import Optional

try:
    import serial as pyserial
    HAS_SER = True
except Exception:
    HAS_SER = False


class EntryDevice:
    """입장장치 — ESP32-C3 팔찌 USB-CDC 직결."""

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
        if self.is_connected:
            print(f"[ENTRY] 이미 연결됨 ({self._port})")
            return True
        if port == self.SIM_PORT:
            self._sim = True
            self._port = self.SIM_PORT
            print("[ENTRY] SIM 가상 연결")
            return True
        if not HAS_SER:
            print("[ENTRY] pyserial 미설치 — 연결 불가")
            return False
        try:
            loop = asyncio.get_running_loop()
            ser = await loop.run_in_executor(
                None, lambda: pyserial.Serial(port, self._baud, timeout=2)
            )
            self._ser = ser
            self._port = port
            print(f"[ENTRY] {port} @ {self._baud} 연결")
            # PING 으로 응답 확인 (펌웨어 부팅 직후라면 빈 줄 가능)
            try:
                pong = await self._send("PING")
                print(f"[ENTRY] PING → {pong!r}")
            except Exception:
                pass
            return True
        except Exception as e:
            print(f"[ENTRY] {port} 열기 실패: {e}")
            self._ser = None
            self._port = None
            return False

    def disconnect(self) -> None:
        if self._sim:
            print("[ENTRY] SIM 해제")
            self._sim = False
            self._port = None
            return
        if self._ser is None:
            return
        try:
            self._ser.close()
        except Exception:
            pass
        print(f"[ENTRY] {self._port} 해제")
        self._ser = None
        self._port = None

    # ── 저수준 송수신 ────────────────────────────────────────
    def _sim_response(self, cmd: str) -> str:
        if cmd == "PING":
            return "OK PONG"
        return "OK"   # WAKE / PASS / DENY / CLEAR

    async def _send(self, line: str) -> str:
        if self._sim:
            await asyncio.sleep(0.1)
            resp = self._sim_response(line.strip())
            print(f"[ENTRY-SIM] {line.strip()} → {resp}")
            return resp
        if self._ser is None:
            raise RuntimeError("ENTRY 미연결")
        async with self._lock:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(
                None, self._ser.write, (line + "\n").encode("ascii", "ignore")
            )
            raw = await loop.run_in_executor(None, self._ser.readline)
        return raw.decode("ascii", errors="replace").strip()

    # ── 의도 기반 명령 ────────────────────────────────────────
    async def wake_wristband(self) -> bool:
        """이미 광고 중이므로 사실상 noop — 디버그 LED 깜빡 트리거."""
        if not self.is_connected:
            return False
        try:
            return (await self._send("WAKE")).startswith("OK")
        except Exception as e:
            print(f"[ENTRY] wake_wristband 오류: {e}")
            return False

    async def signal_pass(self) -> bool:
        """LED SUCCESS 효과 + OLED 표시."""
        if not self.is_connected:
            return False
        try:
            return (await self._send("PASS")).startswith("OK")
        except Exception as e:
            print(f"[ENTRY] signal_pass 오류: {e}")
            return False

    async def signal_deny(self) -> bool:
        if not self.is_connected:
            return False
        try:
            return (await self._send("DENY")).startswith("OK")
        except Exception as e:
            print(f"[ENTRY] signal_deny 오류: {e}")
            return False

    async def clear_wristband(self) -> bool:
        """NFC 태그가 없으므로 즉시 OK (펌웨어도 noop OK 응답)."""
        if not self.is_connected:
            return False
        try:
            return (await self._send("CLEAR")).startswith("OK")
        except Exception as e:
            print(f"[ENTRY] clear_wristband 오류: {e}")
            return False
