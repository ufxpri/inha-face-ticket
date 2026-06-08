#!/usr/bin/env python3
"""Hardware smoke-test helper for FaceTicket firmware.

This script intentionally checks only the transport-level contract:

* Serial: one-line command -> one-line response, using the same strict OK rule
  as the server transport.
* BLE: advertise/connect/read basic GATT values, with optional write/read-back
  checks for the wristband embedding characteristic.
"""

from __future__ import annotations

import argparse
import asyncio
import struct
import sys
import time
from collections.abc import Iterable
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SERVER_SRC = REPO_ROOT / "server" / "src"
sys.path.insert(0, str(SERVER_SRC))

from faceticket.adapters.devices.serial_io import FAILURE_DETAILS  # noqa: E402
from faceticket.config import ble_uuids, led_codes  # noqa: E402

SERIAL_DEFAULT_COMMANDS = ["PING", "DENY", "WAKE", "CLEAR"]
SERIAL_PASS_COMMANDS = ["PING", "PASS", "DENY", "WAKE", "CLEAR"]
SERIAL_OPERATOR_COMMANDS = ["PING", "DENY", "WAKE", "CLEAR", "PASS"]
SERIAL_COMMANDS = {"PING", "PASS", "DENY", "WAKE", "CLEAR"}

LED_CHOICES = {
    "off": led_codes.LED_OFF,
    "success": led_codes.LED_SUCCESS,
    "failure": led_codes.LED_FAILURE,
    "issued": led_codes.LED_ISSUED,
}


def strict_ok(response: str, *, expected: str = "OK") -> bool:
    parts = response.split(" ")
    if not parts or parts[0] != expected:
        return False
    if len(parts) > 1 and parts[1].lower() in FAILURE_DETAILS:
        return False
    return True


def decode_line(raw: bytes) -> str:
    return raw.decode("ascii", errors="replace").strip()


def print_result(ok: bool, label: str, detail: str) -> None:
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {label}: {detail}")


def list_serial_ports() -> int:
    try:
        from serial.tools import list_ports
    except Exception as exc:  # pragma: no cover - depends on local install
        print(f"pyserial is required: {exc}", file=sys.stderr)
        return 2

    ports = list(list_ports.comports())
    if not ports:
        print("No serial ports found.")
        return 1

    for port in ports:
        print(f"{port.device}\t{port.description}")
    return 0


def drain_startup_lines(ser, startup_wait_s: float) -> list[str]:
    if startup_wait_s <= 0:
        return []

    old_timeout = ser.timeout
    ser.timeout = 0.1
    deadline = time.monotonic() + startup_wait_s
    lines: list[str] = []
    while time.monotonic() < deadline:
        raw = ser.readline()
        if raw:
            lines.append(decode_line(raw))
    ser.timeout = old_timeout
    return lines


def serial_expected_success(
    target: str,
    command: str,
    *,
    expect_nfc_placeholder: bool,
) -> bool:
    if target == "arduino" and command in {"WAKE", "CLEAR"} and expect_nfc_placeholder:
        return False
    return True


def run_serial(args: argparse.Namespace) -> int:
    try:
        import serial
    except Exception as exc:  # pragma: no cover - depends on local install
        print(f"pyserial is required: {exc}", file=sys.stderr)
        return 2

    commands = args.commands
    if commands is None:
        if args.operator:
            commands = SERIAL_OPERATOR_COMMANDS
        else:
            commands = SERIAL_PASS_COMMANDS if args.include_pass else SERIAL_DEFAULT_COMMANDS

    invalid = [cmd for cmd in commands if cmd not in SERIAL_COMMANDS]
    if invalid:
        print(f"Unsupported command(s): {', '.join(invalid)}", file=sys.stderr)
        return 2

    failures = 0
    print(f"Opening {args.port} @ {args.baud} ({args.target})")
    with serial.Serial(args.port, args.baud, timeout=args.timeout) as ser:
        startup_lines = drain_startup_lines(ser, args.startup_wait)
        for line in startup_lines:
            print(f"[INFO] startup: {line}")

        for command in commands:
            ser.timeout = args.pass_timeout if command == "PASS" else args.timeout
            ser.reset_input_buffer()
            ser.write((command + "\n").encode("ascii"))
            ser.flush()
            response = decode_line(ser.readline())

            observed_ok = strict_ok(response)
            expected_ok = serial_expected_success(
                args.target,
                command,
                expect_nfc_placeholder=args.expect_nfc_placeholder,
            )
            matched = observed_ok == expected_ok
            if command == "PING":
                matched = matched and response == "OK PONG"

            expectation = "success" if expected_ok else "expected failure"
            print_result(matched, command, f"{response!r} ({expectation})")
            if not matched:
                failures += 1

    return 1 if failures else 0


def smoke_embedding_bytes() -> bytes:
    values = [(idx % 64) / 64.0 for idx in range(512)]
    return struct.pack("<512f", *values)


async def find_ble_device(name: str, address: str | None, timeout: float):
    try:
        from bleak import BleakScanner
    except Exception as exc:  # pragma: no cover - depends on local install
        print(f"bleak is required: {exc}", file=sys.stderr)
        return None

    if address:
        return await BleakScanner.find_device_by_address(address, timeout=timeout)

    def matches(device, advertisement_data) -> bool:
        names = {device.name, advertisement_data.local_name}
        return name in names

    return await BleakScanner.find_device_by_filter(matches, timeout=timeout)


async def run_ble(args: argparse.Namespace) -> int:
    try:
        from bleak import BleakClient
    except Exception as exc:  # pragma: no cover - depends on local install
        print(f"bleak is required: {exc}", file=sys.stderr)
        return 2

    target = args.address or args.name
    print(f"Scanning for BLE wristband: {target}")
    device = await find_ble_device(args.name, args.address, args.scan_timeout)
    if device is None:
        print_result(False, "scan", f"{target} not found")
        return 1

    print_result(True, "scan", f"{device.name or '(no name)'} [{device.address}]")
    failures = 0

    async with BleakClient(device) as client:
        connected = client.is_connected
        print_result(connected, "connect", device.address)
        if not connected:
            return 1

        wristband_id_raw = await client.read_gatt_char(ble_uuids.CHR_ID)
        wristband_id = bytes(wristband_id_raw).decode("ascii", errors="replace")
        print_result(bool(wristband_id), "read-id", wristband_id or "(empty)")
        if not wristband_id:
            failures += 1

        flag_raw = await client.read_gatt_char(ble_uuids.CHR_FLAG)
        contact_flag = bool(flag_raw and flag_raw[0])
        flag_ok = args.allow_contact_flag or not contact_flag
        print_result(flag_ok, "read-contact-flag", str(contact_flag))
        if not flag_ok:
            failures += 1

        if args.seat:
            payload = args.seat.encode("utf-8")
            await client.write_gatt_char(ble_uuids.CHR_SEAT, payload, response=True)
            print_result(True, "write-seat", args.seat)

        if args.led:
            payload = bytes([LED_CHOICES[args.led]])
            await client.write_gatt_char(ble_uuids.CHR_LED, payload, response=True)
            print_result(True, "write-led", args.led)

        if args.write_embedding:
            embedding = smoke_embedding_bytes()
            for offset in range(0, len(embedding), ble_uuids.EMBED_CHUNK):
                chunk = embedding[offset : offset + ble_uuids.EMBED_CHUNK]
                payload = offset.to_bytes(2, "little") + chunk
                await client.write_gatt_char(ble_uuids.CHR_EMBEDDING, payload, response=True)

            checks = [0, len(embedding) - ble_uuids.EMBED_CHUNK]
            for offset in checks:
                await client.write_gatt_char(
                    ble_uuids.CHR_EMB_OFF,
                    offset.to_bytes(2, "little"),
                    response=True,
                )
                actual = bytes(await client.read_gatt_char(ble_uuids.CHR_EMBEDDING))
                expected = embedding[offset : offset + ble_uuids.EMBED_CHUNK]
                matched = actual == expected
                print_result(matched, f"verify-embedding@{offset}", f"{len(actual)} bytes")
                if not matched:
                    failures += 1

    return 1 if failures else 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="FaceTicket hardware smoke tests")
    subparsers = parser.add_subparsers(dest="mode", required=True)

    subparsers.add_parser("list-serial", help="List available serial ports")

    serial_parser = subparsers.add_parser("serial", help="Run serial command smoke test")
    serial_parser.add_argument("--port", required=True, help="Serial port, e.g. /dev/cu.usbmodem1101")
    serial_parser.add_argument("--baud", type=int, default=115200)
    serial_parser.add_argument("--timeout", type=float, default=2.0)
    serial_parser.add_argument("--pass-timeout", type=float, default=7.0)
    serial_parser.add_argument("--startup-wait", type=float, default=2.0)
    serial_parser.add_argument("--target", choices=["arduino", "esp32"], default="arduino")
    serial_parser.add_argument("--include-pass", action="store_true", help="Also run PASS")
    serial_parser.add_argument(
        "--operator",
        action="store_true",
        help="Run the server operator contract command set, including PASS",
    )
    serial_parser.add_argument(
        "--expect-nfc-placeholder",
        action="store_true",
        help="Expect legacy Arduino WAKE/CLEAR placeholder ERR responses",
    )
    serial_parser.add_argument(
        "--commands",
        nargs="+",
        metavar="CMD",
        help="Override command list. Supported: PING PASS DENY WAKE CLEAR",
    )

    ble_parser = subparsers.add_parser("ble", help="Run BLE wristband smoke test")
    ble_parser.add_argument("--name", default=ble_uuids.WRISTBAND_NAME)
    ble_parser.add_argument("--address", help="BLE address. If omitted, scan by name.")
    ble_parser.add_argument("--scan-timeout", type=float, default=8.0)
    ble_parser.add_argument("--allow-contact-flag", action="store_true")
    ble_parser.add_argument("--seat", help="Write a smoke-test seat label")
    ble_parser.add_argument("--led", choices=sorted(LED_CHOICES), help="Write one LED effect")
    ble_parser.add_argument("--write-embedding", action="store_true")

    return parser


def main(argv: Iterable[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.mode == "list-serial":
        return list_serial_ports()
    if args.mode == "serial":
        return run_serial(args)
    if args.mode == "ble":
        return asyncio.run(run_ble(args))

    parser.error(f"Unknown mode: {args.mode}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
