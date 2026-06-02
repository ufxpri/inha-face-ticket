import pytest

from faceticket.adapters.devices.serial_io import SIM_PORT, SerialTransport

pytestmark = pytest.mark.asyncio


async def send_ok_for_response(response: str, *, expected: str = "OK") -> bool:
    transport = SerialTransport(
        "TEST",
        sim_response=lambda _cmd: response,
        sim_latency=0,
    )
    assert await transport.connect(SIM_PORT)
    try:
        return await transport.send_ok("PING", expected=expected)
    finally:
        transport.disconnect()


@pytest.mark.parametrize("response", ["OK", "OK PONG"])
async def test_send_ok_accepts_explicit_ok_responses(response: str) -> None:
    assert await send_ok_for_response(response) is True


@pytest.mark.parametrize(
    "response",
    [
        "",
        "ERR bad command",
        "NO",
        "OK timeout",
        "OKAY",
        " OK",
        "OK\tPONG",
    ],
)
async def test_send_ok_rejects_ambiguous_or_error_responses(response: str) -> None:
    assert await send_ok_for_response(response) is False


async def test_send_ok_honors_expected_response_token() -> None:
    assert await send_ok_for_response("READY", expected="READY") is True
    assert await send_ok_for_response("READY soon", expected="READY") is True
    assert await send_ok_for_response("READYING", expected="READY") is False


class FakeSerial:
    def __init__(self, response: bytes = b"OK\n") -> None:
        self.timeout = 2.0
        self.response = response
        self.writes: list[bytes] = []
        self.timeout_seen_during_read: float | None = None

    def write(self, payload: bytes) -> int:
        self.writes.append(payload)
        return len(payload)

    def readline(self) -> bytes:
        self.timeout_seen_during_read = self.timeout
        return self.response


async def test_send_ok_never_mutates_port_timeout() -> None:
    # Windows pyserial 은 ser.timeout 재설정 시 _reconfigure_port(SetCommState)로 DTR 을 토글해
    # Arduino 를 재리셋/명령 손상시킨다. 그래서 명령별 timeout_s 가 와도 포트 timeout 은 건드리지
    # 않고(열 때 1회 설정값 유지) 데드라인은 파이썬 read 루프로만 처리해야 한다.
    transport = SerialTransport("TEST")
    fake = FakeSerial()
    transport._ser = fake
    transport._port = "/dev/test"

    assert await transport.send_ok("PASS", timeout_s=7.0) is True

    assert fake.writes == [b"PASS\n"]
    assert fake.timeout == 2.0
    assert fake.timeout_seen_during_read == 2.0   # 읽는 동안에도 원래 값 그대로
