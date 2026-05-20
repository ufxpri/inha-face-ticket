"""오프라인 얼굴인증 전자 티켓 시스템 — 노트북 파이썬 서버.

12주차 보고서 § 2.3 에 정의된 모듈 구성:
    - FastAPI 웹 서버 + WebSocket 핸들러
    - 얼굴 임베딩 추출 / 코사인 유사도 (face.py)
    - BLE Central (ble_client.py)
    - 운영자 장치 (issuance_device.py / entry_device.py — DeviceRegistry 로 관리)
    - SQLite 발급 세션 저장소 (db.py)

구조
    ClientPool        WebSocket 집합 + 안전 broadcast
    Session           발급/입장/반납 단일 절차 상태 (단일 운영자 모델)
    FlowController    절차별 비즈니스 로직 — DeviceRegistry.active 만 의존 (DIP)
    DeviceController  io_connect / io_disconnect WS 메시지 처리
    ToggleController  face/ble mock 런타임 토글

보안 주의
    어드민 페이지는 LAN 노출 시 누구나 장치 연결을 끊을 수 있다.
    실운영에선 host="127.0.0.1" 로 바인딩하거나 별도 인증 미들웨어를 추가할 것.
"""
from __future__ import annotations

# Korean Windows 콘솔(cp949)이 em-dash 등 비-ASCII 문자를 못 찍어 죽는 것을 막기 위해
# 다른 모듈 import 전에 stdout/stderr 를 UTF-8 로 재설정.
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8")
    _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

import asyncio
import base64
import datetime as _dt
from contextlib import asynccontextmanager
from typing import Optional

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import (
    DB_PATH, STATIC_DIR, TEMPLATES_DIR, COSINE_THRESHOLD,
    LED_SUCCESS, LED_FAILURE, LED_ISSUED,
    AUTO_CONNECT_ISSUANCE_PORT, AUTO_CONNECT_ENTRY_PORT,
)
from app.face import FaceEngine
from app.ble_client import BLEClient
from app.devices.issuance import IssuanceDevice
from app.devices.entry import EntryDevice
from app.devices.registry import DeviceRegistry, OperatorDevice, list_serial_ports
from app.db import IssueDB
from app.states import State, Flow


# ── 단일 세션 상태 ───────────────────────────────────────────
class Session:
    """진행 중인 발급/입장/반납 절차 상태 (싱글 운영자 모델)."""

    def __init__(self) -> None:
        self.mode: Optional[str] = None        # "issue" | "entry" | "return"
        self.seat: str = ""
        self.name: str = ""
        self.captured_embedding: Optional[np.ndarray] = None
        self.busy: bool = False

    def start(self, mode: str, *, seat: str = "", name: str = "") -> None:
        self.mode = mode
        self.busy = True
        self.seat = seat
        self.name = name
        self.captured_embedding = None

    def reset(self) -> None:
        self.mode = None
        self.seat = ""
        self.name = ""
        self.captured_embedding = None
        self.busy = False


# ── WebSocket 클라이언트 풀 ──────────────────────────────────
class ClientPool:
    """WS 집합. broadcast 시 죽은 소켓은 자동 정리."""

    def __init__(self) -> None:
        self._clients: set[WebSocket] = set()

    def add(self, ws: WebSocket) -> None:    self._clients.add(ws)
    def remove(self, ws: WebSocket) -> None: self._clients.discard(ws)
    def __len__(self) -> int:                return len(self._clients)

    async def broadcast(self, payload: dict) -> None:
        dead: list[WebSocket] = []
        for ws in self._clients:
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._clients.discard(ws)


# ── FlowController ───────────────────────────────────────────
class FlowController:
    """발급/입장/반납 흐름. DIP — `devices.active` (OperatorDevice Protocol) 만 의존.

    핵심 헬퍼:
        _abort()         실패 종료 — log + BLE 정리 + 세션 리셋 + idle 상태
        _complete()      성공 종료 — done 상태 + 세션 리셋
        _ble_session()   BLE 컨텍스트 — 진입 시 연결, 종료 시 항상 해제
        _require_dev()   active 장치 반환. 미연결이면 abort 후 None.
    """

    def __init__(self, face: FaceEngine, ble: BLEClient, devices: DeviceRegistry,
                 db: IssueDB, tablets: ClientPool, admins: ClientPool) -> None:
        self.face = face
        self.ble = ble
        self.devices = devices
        self.db = db
        self.tablets = tablets
        self.admins = admins
        self.session = Session()

    # ── 메시지 송신 ──────────────────────────────────────────
    async def log(self, msg: str, level: str = "info") -> None:
        print(f"[{level.upper()}] {msg}")
        await self.admins.broadcast({"type": "log", "level": level, "msg": msg})

    async def state(self, st: str, **extra) -> None:
        await self.admins.broadcast({"type": "state", "state": st, **extra})

    async def _to_tablet(self, payload: dict) -> None:
        await self.tablets.broadcast(payload)

    # ── 흐름 라이프사이클 헬퍼 ───────────────────────────────
    async def _abort(self, msg: str, level: str = "error") -> None:
        await self.log(msg, level)
        try: await self.ble.disconnect()
        except Exception: pass
        self.session.reset()
        await self.state(State.IDLE)

    async def _complete(self, **extra) -> None:
        await self.state(State.DONE, **extra)
        self.session.reset()
        await asyncio.sleep(2.0)
        if self.session.mode is None:
            await self.state(State.IDLE)

    async def _refuse_if_busy(self, label: str) -> bool:
        if self.session.busy:
            await self.log(f"{label}: 이미 진행 중인 절차가 있습니다.", "warn")
            return True
        return False

    def _require_dev(self) -> Optional[OperatorDevice]:
        """active 장치 반환. 미연결이면 None — 호출측에서 _abort."""
        return self.devices.active

    async def _refuse_if_no_device(self, label: str) -> Optional[OperatorDevice]:
        dev = self._require_dev()
        if dev is None:
            await self.log(f"{label}: 운영자 장치 미연결 — admin 패널에서 연결 후 시도", "warn")
            return None
        return dev

    @asynccontextmanager
    async def _ble_session(self, timeout: float = 15.0):
        ok = await self.ble.connect_wristband(timeout=timeout)
        try:
            yield ok
        finally:
            try: await self.ble.disconnect()
            except Exception: pass

    # ── 발급 ─────────────────────────────────────────────────
    async def issue_start(self, seat: str, name: str) -> None:
        if await self._refuse_if_busy("발급 시작"): return
        if self._require_dev() is None:
            await self.log("발급 시작: 운영자 장치 미연결 — admin 패널에서 연결 후 시도", "warn")
            return
        self.session.start(Flow.ISSUE, seat=seat, name=name)
        await self.log(f"① 발급 세션 시작 — 좌석 {seat}, 이름 {name or '(미지정)'}")
        await self.state(State.AWAIT_FACE)
        await self._to_tablet({"type": "capture_trigger", "mode": Flow.ISSUE, "seat": seat})
        await self.log("② 태블릿에 얼굴 캡처 트리거 송신 (WebSocket)")

    async def issue_tag(self) -> None:
        if self.session.mode != Flow.ISSUE or self.session.captured_embedding is None:
            return await self._abort("발급 절차 상태 오류 — 얼굴 임베딩이 없습니다.")

        dev = self._require_dev()
        if dev is None:
            return await self._abort("운영자 장치 미연결")

        await self.log("④ 운영자 장치에 wake 명령 전송 (Serial)")
        if not await dev.wake_wristband():
            return await self._abort("wake 실패 — 장치 상태를 확인하세요.")

        await self.log("⑤ 팔찌 BLE 광고 대기 후 Central 연결 시도")
        async with self._ble_session() as connected:
            if not connected:
                return await self._abort("BLE 연결 실패")

            await self.log("⑥ 임베딩 / 좌석 정보 write (BLE GATT)")
            if not await self.ble.write_embedding(self.session.captured_embedding):
                return await self._abort("임베딩 write 실패")
            await self.ble.write_seat(self.session.seat)

            wristband_id = await self.ble.read_wristband_id()
            issue_id = self.db.record_issue(wristband_id, self.session.seat, self.session.name)
            await self.log(f"⑦ SQLite 기록 — issue#{issue_id} 팔찌 {wristband_id} "
                           f"→ 좌석 {self.session.seat}")
            await self.ble.write_led_effect(LED_ISSUED)

        await self._to_tablet({"type": "complete", "ok": True, "msg": "발급 완료"})
        await self.log("⑧ 발급 완료 — BLE 연결 해제")
        await self._complete(wristband_id=wristband_id, seat=self.session.seat)

    # ── 입장 ─────────────────────────────────────────────────
    async def entry_start(self) -> None:
        if await self._refuse_if_busy("입장 시작"): return
        if self._require_dev() is None:
            await self.log("입장 시작: 운영자 장치 미연결", "warn")
            return
        self.session.start(Flow.ENTRY)
        await self.log("입장 절차 시작 — 팔찌를 게이트 리더에 태그하세요.")
        await self.state(State.AWAIT_TAG)

    async def entry_tag(self) -> None:
        if self.session.mode != Flow.ENTRY: return

        dev = self._require_dev()
        if dev is None:
            return await self._abort("운영자 장치 미연결")

        await self.log("① wake 명령 전송 (Serial)")
        if not await dev.wake_wristband():
            return await self._abort("wake 실패")

        await self.log("② BLE Central 연결 시도")
        if not await self.ble.connect_wristband(timeout=15.0):
            return await self._abort("BLE 연결 실패")

        try:
            await self.log("③ 팔찌 임베딩 / 체결 플래그 read")
            stored = await self.ble.read_embedding()
            flag_broken = await self.ble.read_contact_flag()

            if stored is None:
                return await self._abort("임베딩 read 실패")
            if flag_broken:
                await self.ble.write_led_effect(LED_FAILURE)
                await dev.signal_deny()
                return await self._abort("⚠ 체결 플래그 = 1 (중간 분리 감지) — 입장 거부", "warn")
            if float(np.linalg.norm(stored)) < 1e-6:
                await self.ble.write_led_effect(LED_FAILURE)
                return await self._abort("⚠ 팔찌에 임베딩이 없습니다 (미발급)", "warn")

            self.session.captured_embedding = stored
            await self.log("④ 태블릿에 얼굴 캡처 트리거 송신")
            await self.state(State.AWAIT_FACE_ENTRY)
            await self._to_tablet({"type": "capture_trigger", "mode": Flow.ENTRY})
        except Exception as e:
            return await self._abort(f"entry 단계 오류: {e}")

    async def entry_after_face(self, live_embedding: np.ndarray) -> None:
        if self.session.mode != Flow.ENTRY or self.session.captured_embedding is None:
            return
        dev = self._require_dev()
        try:
            sim = FaceEngine.cosine(self.session.captured_embedding, live_embedding)
            await self.log(f"⑤ 코사인 유사도 = {sim:.4f} (임곗값 {COSINE_THRESHOLD})")

            if sim >= COSINE_THRESHOLD:
                await self.log("⑥ 통과 판정 — signal_pass")
                passed = bool(dev) and await dev.signal_pass()
                await self.ble.write_led_effect(LED_SUCCESS if passed else LED_FAILURE)
                await self._to_tablet({"type": "complete", "ok": True,
                                       "msg": "통과" if passed else "게이트 통과 미감지"})
                await self.log("⑦ 통과 신호 확인" if passed else "⚠ 통과 감지 타임아웃",
                               "info" if passed else "warn")
            else:
                await self.log("⑥ 거부 — signal_deny", "warn")
                if dev: await dev.signal_deny()
                await self.ble.write_led_effect(LED_FAILURE)
                await self._to_tablet({"type": "complete", "ok": False, "msg": "인증 실패"})
        finally:
            try: await self.ble.disconnect()
            except Exception: pass

        await self._complete(similarity=sim, passed=(sim >= COSINE_THRESHOLD))

    # ── 반납 ─────────────────────────────────────────────────
    async def return_start(self) -> None:
        if await self._refuse_if_busy("반납 시작"): return
        if self._require_dev() is None:
            await self.log("반납 시작: 운영자 장치 미연결", "warn")
            return
        self.session.start(Flow.RETURN)
        await self.log("반납 절차 시작 — 팔찌를 NFC 리더에 태그하세요.")
        await self.state(State.AWAIT_TAG)

    async def return_tag(self) -> None:
        if self.session.mode != Flow.RETURN: return
        dev = self._require_dev()
        if dev is None:
            return await self._abort("운영자 장치 미연결")
        if not await dev.wake_wristband():
            return await self._abort("wake 실패")
        async with self._ble_session() as connected:
            if not connected:
                return await self._abort("BLE 연결 실패")
            wristband_id = await self.ble.read_wristband_id()
            await self.ble.clear_wristband()
        # 장치측 NFC 태그 클리어
        await dev.clear_wristband()
        found = self.db.record_return(wristband_id)
        await self.log(f"반납 완료 — 팔찌 {wristband_id} 초기화" +
                       ("" if found else " (DB에 활성 기록 없음)"))
        await self._complete(wristband_id=wristband_id, returned=found)

    # ── 취소 / 목록 ──────────────────────────────────────────
    async def cancel(self) -> None:
        await self.log("절차 취소", "warn")
        try: await self.ble.disconnect()
        except Exception: pass
        self.session.reset()
        await self.state(State.IDLE)

    async def list_active(self) -> None:
        await self.admins.broadcast({"type": "active_list", "items": self.db.list_active()})


# ── DeviceController ─────────────────────────────────────────
class DeviceController:
    """io_connect / io_disconnect WS 메시지 처리. flags broadcast 동반."""

    def __init__(self, devices: DeviceRegistry, admins: ClientPool, session: Session,
                 toggles_broadcast) -> None:
        self.devices = devices
        self.admins = admins
        self.session = session
        # toggles 의 broadcast_flags 를 콜백으로 받아 순환 의존 회피
        self._broadcast_flags = toggles_broadcast

    async def _log(self, msg: str, level: str = "info") -> None:
        print(f"[{level.upper()}] {msg}")
        await self.admins.broadcast({"type": "log", "level": level, "msg": msg})

    async def handle_connect(self, key: str, port: str) -> None:
        if self.session.busy:
            await self._log("진행 중에는 장치 연결 변경 불가 — CANCEL 후 가능", "warn")
            await self._broadcast_flags(); return
        if not port:
            await self._log(f"{key}: 포트 미지정", "warn"); return
        ok, reason = await self.devices.connect(key, port)
        level = "info" if ok else "warn"
        await self._log(f"{key} connect [{port}] — {reason}", level)
        await self._broadcast_flags()

    async def handle_disconnect(self, key: str) -> None:
        if self.session.busy:
            await self._log("진행 중에는 장치 해제 불가 — CANCEL 후 가능", "warn")
            await self._broadcast_flags(); return
        ok, reason = self.devices.disconnect(key)
        await self._log(f"{key} disconnect — {reason}", "info" if ok else "warn")
        await self._broadcast_flags()


# ── ToggleController (face/ble mock 토글만) ─────────────────
class ToggleController:
    """face/ble mock 런타임 토글. 시리얼 관련 토글은 제거됨 (장치 connect 로 대체)."""

    def __init__(self, face: FaceEngine, ble: BLEClient, devices: DeviceRegistry,
                 admins: ClientPool, tablets: ClientPool, session: Session) -> None:
        self.face = face
        self.ble = ble
        self.devices = devices
        self.admins = admins
        self.tablets = tablets
        self.session = session

    def snapshot(self) -> dict:
        snap = {
            "ml":               self.face.is_ml_active,
            "ble_mock":         self.ble.mock,
            "face_available":   self.face.has_ml,
            "ble_available":    self.ble.real_available,
            "tablet_clients":   len(self.tablets),
            "cosine_threshold": COSINE_THRESHOLD,
            "available_ports":  list_serial_ports(),
        }
        snap.update(self.devices.snapshot())
        return snap

    async def _log(self, msg: str, level: str = "info") -> None:
        print(f"[{level.upper()}] {msg}")
        await self.admins.broadcast({"type": "log", "level": level, "msg": msg})

    async def broadcast_flags(self) -> None:
        await self.admins.broadcast({"type": "flags", **self.snapshot()})

    async def handle(self, data: dict) -> None:
        if self.session.busy:
            await self._log("진행 중에는 mock 전환 불가 — CANCEL 후 가능", "warn")
            await self.broadcast_flags(); return

        layer = data.get("layer")
        mock = bool(data.get("mock"))

        if layer == "face":
            if not self.face.has_ml and not mock:
                await self._log("face: ML 모델이 로드되지 않음 — stub 유지", "warn")
            else:
                self.face.force_stub = mock
                await self._log(f"face → {'STUB' if mock else 'ML'}")
        elif layer == "ble":
            if not mock and not self.ble.real_available:
                await self._log("ble: real backend 사용 불가 (bleak 미설치) — MOCK 유지", "warn")
            else:
                self.ble.mock = mock
                await self._log(f"ble → {'MOCK' if mock else 'REAL'}")
        else:
            await self._log(f"알 수 없는 토글 layer: {layer}", "warn"); return

        await self.broadcast_flags()


# ── 글로벌 인스턴스 (싱글 프로세스 데모) ─────────────────────
face = FaceEngine()
ble = BLEClient()
issuance = IssuanceDevice()
entry = EntryDevice()
devices = DeviceRegistry(issuance, entry)
db = IssueDB(DB_PATH)
tablets = ClientPool()
admins = ClientPool()
flow = FlowController(face, ble, devices, db, tablets, admins)
toggles = ToggleController(face, ble, devices, admins, tablets, flow.session)
device_ctl = DeviceController(devices, admins, flow.session, toggles.broadcast_flags)


# ── 메시지 핸들러 (얇은 라우터) ──────────────────────────────
async def handle_admin_msg(data: dict) -> None:
    t = data.get("type")
    if t == "issue_start":
        await flow.issue_start(str(data.get("seat", "")).strip(),
                               str(data.get("name", "")).strip())
    elif t == "issue_tag":      await flow.issue_tag()
    elif t == "entry_start":    await flow.entry_start()
    elif t == "entry_tag":      await flow.entry_tag()
    elif t == "return_start":   await flow.return_start()
    elif t == "return_tag":     await flow.return_tag()
    elif t == "cancel":         await flow.cancel()
    elif t == "list_active":    await flow.list_active()
    elif t == "toggle":         await toggles.handle(data)
    elif t == "io_connect":
        await device_ctl.handle_connect(str(data.get("device", "")),
                                        str(data.get("port", "")))
    elif t == "io_disconnect":
        await device_ctl.handle_disconnect(str(data.get("device", "")))
    elif t == "io_refresh_ports":
        await toggles.broadcast_flags()


async def handle_tablet_msg(data: dict) -> None:
    if data.get("type") != "image":
        return
    img_b64 = data.get("data", "")
    if "," in img_b64:
        img_b64 = img_b64.split(",", 1)[1]
    try:
        img_bytes = base64.b64decode(img_b64)
    except Exception:
        await tablets.broadcast({"type": "capture_result", "ok": False, "msg": "이미지 디코드 실패"})
        return

    emb, reason = face.extract(img_bytes)
    if emb is None:
        msg = reason or "얼굴 미검출 — 다시 시도"
        await tablets.broadcast({"type": "capture_result", "ok": False, "msg": msg})
        await flow.log(f"캡처 거부: {msg}", "warn")
        return

    emb_list = np.asarray(emb, dtype=np.float32).ravel().tolist()
    await tablets.broadcast({"type": "capture_result", "ok": True,
                             "msg": "인식 완료", "embedding": emb_list})
    await admins.broadcast({
        "type": "embedding",
        "embedding": emb_list,
        "captured_at": _dt.datetime.now().strftime("%H:%M:%S"),
    })

    if flow.session.mode == Flow.ISSUE:
        flow.session.captured_embedding = emb
        await flow.log("③ 얼굴 임베딩 추출 완료. 팔찌를 NFC 리더에 태그하세요.")
        await flow.state(State.AWAIT_TAG)
    elif flow.session.mode == Flow.ENTRY:
        await flow.entry_after_face(emb)


# ── FastAPI 앱 ───────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[SERVER] 기동")
    # 선택적 자동연결 (config.py)
    if AUTO_CONNECT_ISSUANCE_PORT:
        ok, reason = await devices.connect("issuance", AUTO_CONNECT_ISSUANCE_PORT)
        print(f"[SERVER] auto-connect issuance [{AUTO_CONNECT_ISSUANCE_PORT}] → {reason}")
    elif AUTO_CONNECT_ENTRY_PORT:
        ok, reason = await devices.connect("entry", AUTO_CONNECT_ENTRY_PORT)
        print(f"[SERVER] auto-connect entry [{AUTO_CONNECT_ENTRY_PORT}] → {reason}")
    yield
    devices.disconnect_all()
    db.close()
    print("[SERVER] 종료")


app = FastAPI(lifespan=lifespan)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/", response_class=HTMLResponse)
async def root():
    return HTMLResponse(
        "<h2>오프라인 얼굴인증 전자 티켓 시스템</h2>"
        "<ul>"
        "<li><a href='/admin'>운영자 — 발급/입장/반납 페이지</a></li>"
        "<li><a href='/tablet'>관객 — 태블릿 얼굴 캡처 페이지</a></li>"
        "</ul>"
    )


@app.get("/admin", response_class=HTMLResponse)
async def admin_page():
    return FileResponse(TEMPLATES_DIR / "admin.html")


@app.get("/tablet", response_class=HTMLResponse)
async def tablet_page():
    return FileResponse(TEMPLATES_DIR / "tablet.html")


@app.get("/api/active")
async def api_active():
    return JSONResponse({"items": db.list_active()})


@app.get("/api/serial/ports")
async def api_serial_ports():
    """현재 시스템에서 열 수 있는 COM 포트 목록.

    보안 주의: 운영자 권한이 없는 외부에서 호출 가능하면 장치 정보 누설.
    LAN 노출 시에는 server 기동 시 host="127.0.0.1" 또는 별도 가드 추가 필요.
    """
    return JSONResponse({"ports": list_serial_ports()})


@app.websocket("/ws/admin")
async def ws_admin(ws: WebSocket):
    await ws.accept()
    admins.add(ws)
    await ws.send_json({"type": "hello", "role": "admin", **toggles.snapshot()})
    try:
        while True:
            data = await ws.receive_json()
            await handle_admin_msg(data)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WS-ADMIN] 오류: {e}")
    finally:
        admins.remove(ws)


@app.websocket("/ws/tablet")
async def ws_tablet(ws: WebSocket):
    await ws.accept()
    tablets.add(ws)
    await ws.send_json({"type": "hello", "role": "tablet",
                        "cosine_threshold": COSINE_THRESHOLD})
    await toggles.broadcast_flags()
    try:
        while True:
            data = await ws.receive_json()
            await handle_tablet_msg(data)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WS-TABLET] 오류: {e}")
    finally:
        tablets.remove(ws)
        await toggles.broadcast_flags()


if __name__ == "__main__":
    import uvicorn
    # LAN 노출이 부담스러우면 host="127.0.0.1" 로 변경 권장.
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
