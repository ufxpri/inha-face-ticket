"""SerialTransport — IssuanceDevice / EntryDevice 가 공유하는 connect/send 구현.

기존엔 issuance.py / entry.py 가 80% 동일한 코드를 복붙으로 갖고 있었다. 이제 transport 는
한 곳에만 있고, 각 device 는 어떤 명령 문자열을 어떤 응답으로 해석하는지만 정의한다.
"""
from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable

try:
    import serial as pyserial
    HAS_PYSERIAL = True
except Exception:
    HAS_PYSERIAL = False

log = logging.getLogger(__name__)

SIM_PORT = "SIM"
FAILURE_DETAILS = {"timeout", "err", "error", "fail", "failed"}

# 명령 → 가짜 응답 함수
SimResponseFn = Callable[[str], str]


class SerialTransport:
    """USB-CDC / 시리얼 트랜스포트. baud, port 캡슐화. SIM 모드 지원."""

    def __init__(
        self,
        name: str,
        *,
        baud: int = 115200,
        timeout_s: float = 2.0,
        sim_response: SimResponseFn | None = None,
        sim_latency: float = 0.2,
    ) -> None:
        self.name = name
        self._baud = baud
        self._timeout_s = timeout_s
        self._sim_response = sim_response or (lambda _cmd: "OK")
        self._sim_latency = sim_latency

        self._ser: pyserial.Serial | None = None
        self._port: str | None = None
        self._sim: bool = False
        self._lock = asyncio.Lock()

    # ── 상태 ─────────────────────────────────────────────────
    @property
    def is_connected(self) -> bool:
        return self._ser is not None or self._sim

    @property
    def port(self) -> str | None:
        return self._port

    # ── 라이프사이클 ─────────────────────────────────────────
    async def connect(self, port: str) -> bool:
        if self.is_connected:
            log.info("[%s] 이미 연결됨 (%s)", self.name, self._port)
            return True
        if port == SIM_PORT:
            self._sim = True
            self._port = SIM_PORT
            log.info("[%s] SIM 가상 연결", self.name)
            return True
        if not HAS_PYSERIAL:
            log.warning("[%s] pyserial 미설치 — 연결 불가", self.name)
            return False
        try:
            loop = asyncio.get_running_loop()
            ser = await loop.run_in_executor(
                None, lambda: pyserial.Serial(port, self._baud, timeout=self._timeout_s)
            )
            self._ser = ser
            self._port = port
            log.info("[%s] %s @ %d 연결", self.name, port, self._baud)
            return True
        except Exception as e:
            log.warning("[%s] %s 열기 실패: %s", self.name, port, e)
            self._ser = None
            self._port = None
            return False

    def disconnect(self) -> None:
        if self._sim:
            log.info("[%s] SIM 해제", self.name)
            self._sim = False
            self._port = None
            return
        if self._ser is None:
            return
        try:
            self._ser.close()
        except Exception:
            pass
        log.info("[%s] %s 해제", self.name, self._port)
        self._ser = None
        self._port = None

    # ── 송수신 ───────────────────────────────────────────────
    async def send(self, line: str, *, timeout_s: float | None = None) -> str:
        """한 줄 송신 → 한 줄 응답. 미연결이면 RuntimeError."""
        if self._sim:
            await asyncio.sleep(self._sim_latency)
            resp = self._sim_response(line.strip())
            log.info("[%s-SIM] %s → %s", self.name, line.strip(), resp)
            return resp
        if self._ser is None:
            raise RuntimeError(f"{self.name} 미연결")
        async with self._lock:
            loop = asyncio.get_running_loop()
            old_timeout = self._ser.timeout
            if timeout_s is not None:
                self._ser.timeout = timeout_s
            try:
                await loop.run_in_executor(
                    None, self._ser.write, (line + "\n").encode("ascii", "ignore")
                )
                raw = await loop.run_in_executor(None, self._ser.readline)
            finally:
                self._ser.timeout = old_timeout
        return raw.decode("ascii", errors="replace").strip()

    async def send_ok(
        self,
        line: str,
        *,
        expected: str = "OK",
        timeout_s: float | None = None,
    ) -> bool:
        """응답의 첫 공백 구분 토큰이 `expected` 와 정확히 같으면 True."""
        try:
            resp = await self.send(line, timeout_s=timeout_s)
        except Exception as e:
            log.warning("[%s] %r 송신 오류: %s", self.name, line, e)
            return False
        parts = resp.split(" ")
        if not parts or parts[0] != expected:
            return False
        if len(parts) > 1 and parts[1].lower() in FAILURE_DETAILS:
            return False
        return True
