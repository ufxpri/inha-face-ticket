"""WS 클라이언트 집합 — broadcast + 죽은 소켓 정리."""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fastapi import WebSocket


class ClientPool:
    def __init__(self) -> None:
        self._clients: set["WebSocket"] = set()

    def add(self, ws: "WebSocket") -> None:
        self._clients.add(ws)

    def remove(self, ws: "WebSocket") -> None:
        self._clients.discard(ws)

    def __len__(self) -> int:
        return len(self._clients)

    async def broadcast(self, payload: dict) -> None:
        dead: list["WebSocket"] = []
        for ws in self._clients:
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._clients.discard(ws)
