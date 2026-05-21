"""WS wire format — 한 곳에서만 정의되는 메시지 스키마.

이전엔 `{"type": "state", ...}` 같은 dict 리터럴이 main.py 곳곳에 흩어져 있어서 프론트엔드와
서버 양쪽이 키를 외워서 맞추는 식이었다. 이제 모든 outbound 메시지는 이 모듈의 빌더 함수가
만들고, inbound 는 `parse_admin_message` 가 dataclass 로 정규화한다.

추가 메시지를 만들 땐 빌더 함수 하나 + (필요 시) tablet/admin JSX 의 매칭 코드 하나.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from faceticket.domain.states import Flow, FlowState

# ── outbound 빌더 ────────────────────────────────────────────


def msg_hello(role: str, **extra: Any) -> dict:
    return {"type": "hello", "role": role, **extra}


def msg_log(msg: str, level: str = "info") -> dict:
    return {"type": "log", "level": level, "msg": msg}


def msg_state(state: FlowState, **extra: Any) -> dict:
    return {"type": "state", "state": state.value, **extra}


def msg_capture_trigger(flow: Flow, *, seat: str = "") -> dict:
    payload: dict[str, Any] = {"type": "capture_trigger", "mode": flow.value}
    if seat:
        payload["seat"] = seat
    return payload


def msg_capture_result(ok: bool, msg: str, embedding: Optional[list[float]] = None) -> dict:
    out: dict[str, Any] = {"type": "capture_result", "ok": ok, "msg": msg}
    if embedding is not None:
        out["embedding"] = embedding
    return out


def msg_embedding_snapshot(embedding: list[float], captured_at: str) -> dict:
    return {"type": "embedding", "embedding": embedding, "captured_at": captured_at}


def msg_complete(ok: bool, msg: str, **extra: Any) -> dict:
    return {"type": "complete", "ok": ok, "msg": msg, **extra}


def msg_active_list(items: list[dict]) -> dict:
    return {"type": "active_list", "items": items}


def msg_flags(snapshot: dict) -> dict:
    return {"type": "flags", **snapshot}


# ── inbound 정규화 ───────────────────────────────────────────


@dataclass(frozen=True)
class AdminCommand:
    """admin → server 명령."""
    type: str
    seat: str = ""
    name: str = ""
    layer: str = ""               # toggle 용 ("face" | "ble")
    mock: bool = False            # toggle 용
    port: str = ""                # io_connect 용


def parse_admin_message(data: dict) -> AdminCommand:
    """raw dict → 타입 안전 dataclass."""
    return AdminCommand(
        type=str(data.get("type", "")),
        seat=str(data.get("seat", "")).strip(),
        name=str(data.get("name", "")).strip(),
        layer=str(data.get("layer", "")),
        mock=bool(data.get("mock", False)),
        port=str(data.get("port", "")),
    )
