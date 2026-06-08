#!/usr/bin/env python3
"""Run a full issue -> entry -> return demo smoke test against a running server.

This script drives the same WebSocket paths as the browser UIs:

* admin WebSocket sends flow commands.
* tablet WebSocket receives capture triggers and submits image payloads.

Use it after hardware-level smoke tests pass and the server is already running
with a real operator port and BLE enabled.
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import json
import sys
import time
from collections.abc import Callable
from pathlib import Path
from typing import Any


JsonMessage = dict[str, Any]
Predicate = Callable[[JsonMessage], bool]


def build_ws_url(base_url: str, path: str) -> str:
    base = base_url.rstrip("/")
    if base.startswith("http://"):
        base = "ws://" + base[len("http://") :]
    elif base.startswith("https://"):
        base = "wss://" + base[len("https://") :]
    if not base.startswith(("ws://", "wss://")):
        base = "ws://" + base
    return f"{base}{path}"


def load_image_payload(args: argparse.Namespace) -> str:
    if args.image_file:
        raw = Path(args.image_file).read_bytes()
    else:
        raw = args.image_text.encode("utf-8")
    return base64.b64encode(raw).decode("ascii")


def summarize_message(msg: JsonMessage) -> str:
    msg_type = msg.get("type")
    if msg_type == "embedding":
        emb = msg.get("embedding") or []
        return f"embedding len={len(emb)} captured_at={msg.get('captured_at')}"
    if msg_type == "capture_result" and "embedding" in msg:
        emb = msg.get("embedding") or []
        return f"capture_result ok={msg.get('ok')} msg={msg.get('msg')!r} embedding_len={len(emb)}"
    if msg_type == "flags":
        device = msg.get("device_status") or {}
        return (
            "flags "
            f"ble_mock={msg.get('ble_mock')} "
            f"ble_available={msg.get('ble_available')} "
            f"device={device.get('port')}"
        )
    return json.dumps(msg, ensure_ascii=False, separators=(",", ":"))


async def recv_json(ws) -> JsonMessage:
    return json.loads(await ws.recv())


async def recv_until(
    ws,
    predicate: Predicate,
    label: str,
    *,
    timeout: float,
    verbose: bool,
) -> JsonMessage:
    deadline = asyncio.get_running_loop().time() + timeout
    while True:
        remaining = deadline - asyncio.get_running_loop().time()
        if remaining <= 0:
            raise TimeoutError(f"timeout waiting for {label}")
        msg = await asyncio.wait_for(recv_json(ws), timeout=remaining)
        if verbose or msg.get("type") in {"state", "log", "complete"}:
            print(f"[{label}] {summarize_message(msg)}")
        if predicate(msg):
            return msg


async def wait_state(admin_ws, state: str, args: argparse.Namespace) -> JsonMessage:
    return await recv_until(
        admin_ws,
        lambda msg: msg.get("type") == "state" and msg.get("state") == state,
        f"state:{state}",
        timeout=args.timeout,
        verbose=args.verbose,
    )


async def wait_capture(tablet_ws, mode: str, args: argparse.Namespace) -> JsonMessage:
    return await recv_until(
        tablet_ws,
        lambda msg: msg.get("type") == "capture_trigger" and msg.get("mode") == mode,
        f"capture:{mode}",
        timeout=args.timeout,
        verbose=args.verbose,
    )


async def wait_complete(tablet_ws, flow: str, args: argparse.Namespace) -> JsonMessage:
    msg = await recv_until(
        tablet_ws,
        lambda item: item.get("type") == "complete" and item.get("flow") == flow,
        f"complete:{flow}",
        timeout=args.timeout,
        verbose=args.verbose,
    )
    if not msg.get("ok"):
        raise RuntimeError(f"{flow} failed: {summarize_message(msg)}")
    return msg


async def send_admin(ws, msg_type: str, **extra: Any) -> None:
    await ws.send(json.dumps({"type": msg_type, **extra}, ensure_ascii=False))


async def send_image(tablet_ws, image_payload: str) -> None:
    await tablet_ws.send(json.dumps({"type": "image", "data": image_payload}))


def print_pass(label: str, msg: JsonMessage) -> None:
    print(f"[PASS] {label}: {summarize_message(msg)}")


async def run_e2e(args: argparse.Namespace) -> int:
    try:
        import websockets
    except Exception as exc:  # pragma: no cover - depends on local install
        print(f"websockets is required: {exc}", file=sys.stderr)
        return 2

    admin_url = build_ws_url(args.base_url, "/ws/admin")
    tablet_url = build_ws_url(args.base_url, "/ws/tablet")
    image_payload = load_image_payload(args)
    seat = args.seat or f"E2E-{time.strftime('%H%M%S')}"

    print(f"Connecting admin:  {admin_url}")
    print(f"Connecting tablet: {tablet_url}")
    print(f"Using seat={seat!r}, name={args.name!r}")

    async with websockets.connect(admin_url) as admin_ws:
        async with websockets.connect(tablet_url) as tablet_ws:
            print(f"[INFO] admin hello: {summarize_message(await recv_json(admin_ws))}")
            print(f"[INFO] tablet hello: {summarize_message(await recv_json(tablet_ws))}")

            await send_admin(admin_ws, "issue_start", seat=seat, name=args.name)
            await wait_capture(tablet_ws, "issue", args)
            await send_image(tablet_ws, image_payload)
            await wait_state(admin_ws, "await_tag", args)
            await send_admin(admin_ws, "issue_tag")
            issue = await wait_complete(tablet_ws, "issue", args)
            await wait_state(admin_ws, "idle", args)
            print_pass("issue", issue)

            await send_admin(admin_ws, "entry_start")
            await wait_state(admin_ws, "await_tag", args)
            await send_admin(admin_ws, "entry_tag")
            await wait_capture(tablet_ws, "entry", args)
            await send_image(tablet_ws, image_payload)
            entry = await wait_complete(tablet_ws, "entry", args)
            await wait_state(admin_ws, "idle", args)
            print_pass("entry", entry)

            await send_admin(admin_ws, "return_start")
            await wait_state(admin_ws, "await_tag", args)
            await send_admin(admin_ws, "return_tag")
            returned = await wait_complete(tablet_ws, "return", args)
            await wait_state(admin_ws, "idle", args)
            print_pass("return", returned)

    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run FaceTicket E2E demo smoke test")
    parser.add_argument(
        "--base-url",
        default="http://127.0.0.1:8765",
        help="Running server base URL. http(s) is converted to ws(s).",
    )
    parser.add_argument("--seat", help="Seat label. Defaults to E2E-<HHMMSS>.")
    parser.add_argument("--name", default="Smoke", help="Issue name.")
    parser.add_argument(
        "--image-text",
        default="faceticket-e2e-same-face",
        help="Text bytes used as deterministic FT_FACE_STUB image input.",
    )
    parser.add_argument(
        "--image-file",
        help="Optional image file payload. Use the same file for issue and entry.",
    )
    parser.add_argument("--timeout", type=float, default=75.0)
    parser.add_argument("--verbose", action="store_true", help="Print all received messages.")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        return asyncio.run(run_e2e(args))
    except KeyboardInterrupt:
        return 130
    except Exception as exc:
        print(f"[FAIL] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
