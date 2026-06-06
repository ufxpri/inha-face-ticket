"""SerialTransport — IssuanceDevice / EntryDevice 가 공유하는 connect/send 구현.

기존엔 issuance.py / entry.py 가 80% 동일한 코드를 복붙으로 갖고 있었다. 이제 transport 는
한 곳에만 있고, 각 device 는 어떤 명령 문자열을 어떤 응답으로 해석하는지만 정의한다.
"""
from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Callable

try:
    import serial as pyserial
    HAS_PYSERIAL = True
except Exception:
    HAS_PYSERIAL = False

log = logging.getLogger(__name__)

SIM_PORT = "SIM"
FAILURE_DETAILS = {"timeout", "err", "error", "fail", "failed"}

# 실제 포트 오픈 직후 — 보드가 DTR auto-reset 으로 리부트할 시간을 준 뒤 부팅 잔여 바이트를 flush.
# native USB-CDC(리셋 없는 보드)는 짧게만 안정화. 실제 깨어남 확인은 OperatorDevice 의 PING 핸드셰이크가 담당.
OPEN_SETTLE_S = 0.4

# 포트는 이 작은 폴링 타임아웃으로 한 번만 연다. 명령별 데드라인은 파이썬 read 루프로 구현하고
# 절대 `ser.timeout` 을 재설정하지 않는다 — Windows pyserial 은 timeout 변경 시 _reconfigure_port
# (SetCommState) 를 호출해 DTR 라인을 토글하고, 그러면 Arduino UNO 가 재리셋되거나 다음 명령 앞에
# 쓰레기 바이트가 끼어 `ERR UNKNOWN <garbage>CMD` 로 깨진다. (실측 확인됨)
READ_POLL_S = 0.15

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
            # 작은 폴링 타임아웃으로 한 번만 연다. 이후 timeout 을 바꾸지 않는다(위 READ_POLL_S 주석).
            ser = await loop.run_in_executor(
                None, lambda: pyserial.Serial(port, self._baud, timeout=READ_POLL_S)
            )
            self._ser = ser
            self._port = port
            log.info("[%s] %s @ %d 연결", self.name, port, self._baud)
            # DTR auto-reset 리부트 안정화 + 부팅 로그 잔여 바이트 제거.
            # (안 하면 첫 명령이 부팅 텍스트 한 줄을 응답으로 오독 → 실패)
            await asyncio.sleep(OPEN_SETTLE_S)
            try:
                await loop.run_in_executor(None, ser.reset_input_buffer)
                await loop.run_in_executor(None, ser.reset_output_buffer)
            except Exception:
                pass
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
    def _read_line(self, deadline_s: float) -> bytes:
        """포트 timeout(READ_POLL_S)을 바꾸지 않고, 한 줄(\\n/\\r) 또는 deadline 까지 누적 read.

        `ser.timeout` 재설정이 Arduino 를 글리치시키므로(READ_POLL_S 주석) 데드라인은 여기서만 처리.
        """
        end = time.monotonic() + deadline_s
        buf = bytearray()
        while time.monotonic() < end:
            chunk = self._ser.readline()         # \n 까지 또는 READ_POLL_S 후 반환
            if chunk:
                buf += chunk
                if buf.endswith(b"\n") or buf.endswith(b"\r"):
                    break
        return bytes(buf)

    async def send(self, line: str, *, timeout_s: float | None = None) -> str:
        """한 줄 송신 → 한 줄 응답. 미연결이면 RuntimeError."""
        if self._sim:
            await asyncio.sleep(self._sim_latency)
            resp = self._sim_response(line.strip())
            log.info("[%s-SIM] %s → %s", self.name, line.strip(), resp)
            return resp
        if self._ser is None:
            raise RuntimeError(f"{self.name} 미연결")
        deadline = self._timeout_s if timeout_s is None else timeout_s

        def _io() -> bytes:
            # 직전 명령의 지각 응답·비동기 부팅 로그 등 잔여 입력을 버리고 깨끗한 1-req/1-resp 보장.
            try:
                self._ser.reset_input_buffer()
            except Exception:
                pass
            self._ser.write((line + "\n").encode("ascii", "ignore"))
            return self._read_line(deadline)

        async with self._lock:
            loop = asyncio.get_running_loop()
            raw = await loop.run_in_executor(None, _io)
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
