"""표준 logging 설정 + WS 로그 핸들러.

console + admin WS 두 sink. application/adapter 모듈은 모두 `logging.getLogger(__name__)`
사용 → 한 곳에서 레벨/포맷/필터 조정.
"""
from __future__ import annotations

import asyncio
import logging
import sys
from typing import Any, Callable, Coroutine, Optional


def configure_logging(level: int = logging.INFO) -> None:
    """프로세스 시작 시 한 번 호출. UTF-8 콘솔 + 표준 포맷."""
    # Windows cp949 콘솔이 em-dash 등에서 죽지 않도록
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
        sys.stderr.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except Exception:
        pass

    root = logging.getLogger()
    if root.handlers:                              # 중복 호출 방지
        return
    root.setLevel(level)
    h = logging.StreamHandler(sys.stdout)
    h.setFormatter(logging.Formatter(
        "%(asctime)s %(levelname)-5s %(name)s — %(message)s",
        datefmt="%H:%M:%S",
    ))
    root.addHandler(h)


class WebSocketLogHandler(logging.Handler):
    """logging.Record → presenter.emit_log 비동기 forward.

    logging 은 sync 인데 emit_log 는 async — `asyncio.create_task` 로 스케줄링한다.
    presenter 가 아직 wiring 되지 않은 import 단계에선 set_emitter 호출 전이라 noop.
    """

    def __init__(self, level: int = logging.INFO) -> None:
        super().__init__(level=level)
        self._emit: Optional[Callable[[str, str], Coroutine[Any, Any, None]]] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def set_emitter(
        self,
        emit_async: Callable[[str, str], Coroutine[Any, Any, None]],
        loop: asyncio.AbstractEventLoop,
    ) -> None:
        self._emit = emit_async
        self._loop = loop

    def emit(self, record: logging.LogRecord) -> None:
        if self._emit is None or self._loop is None:
            return
        try:
            msg = self.format(record)
        except Exception:
            return
        level = {
            logging.DEBUG: "info",
            logging.INFO: "info",
            logging.WARNING: "warn",
            logging.ERROR: "error",
            logging.CRITICAL: "error",
        }.get(record.levelno, "info")
        # 메인 루프에 task 로 던진다
        try:
            asyncio.run_coroutine_threadsafe(self._emit(msg, level), self._loop)
        except Exception:
            pass


def attach_ws_log_handler(
    presenter,
    loop: asyncio.AbstractEventLoop,
    *,
    level: int = logging.INFO,
) -> WebSocketLogHandler:
    """루프 시작 후 한 번 호출. presenter.emit_log 로 record forward."""
    h = WebSocketLogHandler(level=level)
    h.setFormatter(logging.Formatter("%(message)s"))
    h.set_emitter(presenter.emit_log, loop)
    logging.getLogger().addHandler(h)
    return h
