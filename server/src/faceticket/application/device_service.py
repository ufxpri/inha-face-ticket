"""운영자 장치 connect/disconnect 유스케이스 — 역할(NFC/GATE)별 라우팅.

NFC 리더와 입장 게이트가 서로 다른 포트에 있으므로 connect/disconnect 는 대상 role 을
받는다. 진행 중일 땐 거부, 변경 후 flags broadcast.
"""
from __future__ import annotations

import asyncio
import logging

from faceticket.application.ports import (
    LED_COMMANDS,
    LED_PATTERNS,
    ROLE_NFC,
    ROLES,
    IOperatorDevice,
    IPresenter,
)
from faceticket.domain.session import Session

log = logging.getLogger(__name__)


class DeviceService:
    """장치 연결 변경 — 진행 중일 땐 거부, 변경 후 flags broadcast."""

    def __init__(
        self,
        *,
        device: IOperatorDevice,
        session: Session,
        presenter: IPresenter,
        flags_emitter,             # async () -> None
    ) -> None:
        self.device = device
        self.session = session
        self.presenter = presenter
        self._emit_flags = flags_emitter
        # 서버 측 LED 패턴 재생 — 현재 재생 중인 패턴 이름과 백그라운드 태스크.
        self._pattern_name: str = ""
        self._pattern_task: asyncio.Task | None = None

    @property
    def led_pattern(self) -> str:
        """재생 중인 LED 패턴 명령 ("" = 정지). flags 스냅샷에 노출됨."""
        return self._pattern_name

    def _role_connected(self, role: str) -> bool:
        return bool(self.device.status_snapshot().get(role, {}).get("connected"))

    async def connect(self, port: str, role: str = ROLE_NFC) -> None:
        if role not in ROLES:
            await self.presenter.emit_log(f"operator: 알 수 없는 역할 [{role}]", "warn")
            return
        if self.session.busy:
            await self.presenter.emit_log("진행 중에는 장치 연결 변경 불가 — CANCEL 후 가능", "warn")
            await self._emit_flags()
            return
        if not port:
            await self.presenter.emit_log(f"operator[{role}]: 포트 미지정", "warn")
            return
        if self._role_connected(role):
            await self.presenter.emit_log(f"operator[{role}]: 이미 연결됨", "warn")
            await self._emit_flags()
            return
        ok = await self.device.connect_role(role, port)
        await self.presenter.emit_log(
            f"operator[{role}] connect [{port}] — {'연결 성공' if ok else f'{port} 열기 실패'}",
            "info" if ok else "warn",
        )
        await self._emit_flags()

    async def disconnect(self, role: str = ROLE_NFC) -> None:
        if role not in ROLES:
            await self.presenter.emit_log(f"operator: 알 수 없는 역할 [{role}]", "warn")
            return
        if self.session.busy:
            await self.presenter.emit_log("진행 중에는 장치 해제 불가 — CANCEL 후 가능", "warn")
            await self._emit_flags()
            return
        if not self._role_connected(role):
            await self.presenter.emit_log(f"operator[{role}]: 이미 해제됨", "info")
            return
        if role == ROLE_NFC:
            await self._stop_pattern_task()      # NFC 끊기면 재생 중인 LED 패턴도 정지
        self.device.disconnect_role(role)
        await self.presenter.emit_log(f"operator[{role}] disconnect — 해제됨", "info")
        await self._emit_flags()

    async def refresh_ports(self) -> None:
        await self._emit_flags()

    async def set_led(self, command: str) -> None:
        """팔찌 LED 명령. 단색은 즉시 전송, PATTERN * 은 서버가 프리미티브를 연속 전송해 재생."""
        command = (command or "").strip()
        if not self._role_connected(ROLE_NFC):
            await self.presenter.emit_log("LED: NFC 미연결 — 먼저 NFC 보드를 연결하세요", "warn")
            return

        if command in LED_PATTERNS:
            await self._start_pattern(command)
            return

        if command not in LED_COMMANDS:
            await self.presenter.emit_log(f"LED: 지원하지 않는 명령 [{command}]", "warn")
            return

        # 단색 전송은 재생 중인 패턴을 멈춘다 (단색이 곧 새 상태).
        await self._stop_pattern_task()
        ok = await self.device.set_led(command)
        await self.presenter.emit_log(
            f"LED [{command}] — {'전송 성공' if ok else '전송 실패 (보드 응답 없음/ERR)'}",
            "info" if ok else "warn",
        )

    async def stop_led(self) -> None:
        """LED 패턴 정지 + 소등. 패턴이 없어도 OFF 전송."""
        if not self._role_connected(ROLE_NFC):
            await self.presenter.emit_log("LED: NFC 미연결", "warn")
            return
        await self._stop_pattern_task()
        await self.device.set_led("RGB OFF")
        await self.presenter.emit_log("LED 정지 — 소등", "info")

    # ── LED 패턴 플레이어 ────────────────────────────────────
    async def _start_pattern(self, command: str) -> None:
        await self._cancel_pattern_task()        # 이전 패턴은 OFF 없이 교체
        self._pattern_name = command
        self._pattern_task = asyncio.create_task(self._run_pattern(command))
        await self.presenter.emit_log(f"LED 패턴 [{command}] — 재생 시작", "info")
        await self._emit_flags()

    async def _run_pattern(self, command: str) -> None:
        frames = LED_PATTERNS[command]
        try:
            while True:
                for cmd, hold_s in frames:
                    # 플로우 진행 중엔 NFC 시리얼을 양보 (WAKE/CLEAR 와 충돌 회피).
                    if not self.session.busy and self._role_connected(ROLE_NFC):
                        await self.device.set_led(cmd)
                    await asyncio.sleep(hold_s)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("[LED] 패턴 재생 오류 [%s]", command)

    async def _cancel_pattern_task(self) -> None:
        """재생 태스크만 취소 (OFF/로그/브로드캐스트 없음 — 교체용)."""
        task = self._pattern_task
        self._pattern_task = None
        if task is not None and not task.done():
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass

    async def _stop_pattern_task(self) -> None:
        """재생 중이면 정지하고 상태 비움 + 브로드캐스트 (OFF 전송은 호출자 책임)."""
        had = bool(self._pattern_name)
        await self._cancel_pattern_task()
        if had:
            self._pattern_name = ""
            await self._emit_flags()
