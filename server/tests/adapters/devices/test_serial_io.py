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
