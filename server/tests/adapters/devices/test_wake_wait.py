"""OperatorDevice.wake_wristband_wait 폴링 로직 — NO_TAG 재시도 / 하드웨어오류 즉시실패 / 타임아웃."""
import pytest

from faceticket.adapters.devices.operator import OperatorDevice

pytestmark = pytest.mark.asyncio


def make_device(responses):
    """SerialTransport.send 를 미리 정한 응답 시퀀스로 대체한 OperatorDevice."""
    dev = OperatorDevice()
    seq = list(responses)
    calls = {"n": 0}

    async def fake_send(line, *, timeout_s=None):
        calls["n"] += 1
        # 마지막 응답을 반복 (시퀀스보다 더 호출되면)
        return seq[min(calls["n"] - 1, len(seq) - 1)]

    dev._t.send = fake_send  # type: ignore[assignment]
    return dev, calls


async def test_wake_succeeds_first_try() -> None:
    dev, calls = make_device(["OK"])
    assert await dev.wake_wristband_wait(timeout_s=2.0) is True
    assert calls["n"] == 1


async def test_wake_retries_on_no_tag_then_succeeds() -> None:
    # 두 번 NO_TAG 후 태그 접촉 → OK
    dev, calls = make_device(["ERR NFC_NO_TAG", "ERR NFC_NO_TAG", "OK"])
    assert await dev.wake_wristband_wait(timeout_s=5.0) is True
    assert calls["n"] == 3


async def test_wake_fails_fast_on_hardware_error() -> None:
    # RF_FAILED 는 재시도 불가 — 한 번만 시도하고 즉시 False
    dev, calls = make_device(["ERR NFC_RF_FAILED"])
    assert await dev.wake_wristband_wait(timeout_s=5.0) is False
    assert calls["n"] == 1


async def test_wake_times_out_when_tag_never_appears() -> None:
    # 계속 NO_TAG → deadline 도달 시 False (짧은 타임아웃으로 빠르게)
    dev, calls = make_device(["ERR NFC_NO_TAG"])
    assert await dev.wake_wristband_wait(timeout_s=0.5) is False
    assert calls["n"] >= 1


async def test_wake_treats_ok_timeout_token_as_failure() -> None:
    # "OK timeout" 은 send_ok 규칙상 실패 토큰 — NO_TAG 도 아니므로 즉시 False
    dev, calls = make_device(["OK timeout"])
    assert await dev.wake_wristband_wait(timeout_s=2.0) is False
    assert calls["n"] == 1
