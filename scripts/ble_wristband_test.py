#!/usr/bin/env python3
"""팔찌 BLE 독립 테스트 — 서버(uvicorn) 를 거치지 않고 standalone bleak 으로 직접.

서버 flow 가 하는 BLE 데이터 교환을 그대로 재현한다:
  - 연결 / 팔찌 ID read / 체결 플래그 read
  - 2048B(512 float32) 임베딩을 256B 8청크로 write
  - 오프셋 컨트롤로 8청크 전체 read-back → 무손실 검증
  - 좌석 write

팔찌가 ESP-NOW 모드면 먼저 COM7 시리얼로 GOBLE(또는 TRIGNFC) 해서 BLE 모드로 전환한다.
서버 BLE hang 디버깅용: 이게 통과하면 펌웨어/BLE 는 정상이고 문제는 서버 컨텍스트로 좁혀진다.

사용법:  python scripts/ble_wristband_test.py [--port COM7] [--no-serial]
"""
from __future__ import annotations

import argparse
import asyncio
import struct
import sys
import time

from bleak import BleakClient, BleakScanner

NAME = "FaceTicket-Wristband"
CHR_ID = "12345678-1234-5678-1234-56789abcdef5"
CHR_FLAG = "12345678-1234-5678-1234-56789abcdef3"
CHR_EMB = "12345678-1234-5678-1234-56789abcdef1"
CHR_OFF = "12345678-1234-5678-1234-56789abcdef6"
CHR_SEAT = "12345678-1234-5678-1234-56789abcdef2"
CHR_CTRL = "12345678-1234-5678-1234-56789abcdef7"

EMBED_DIM = 512
EMBED_BYTES = EMBED_DIM * 4
CHUNK = 256


def ok(label, cond, detail=""):
    print(f"[{'PASS' if cond else 'FAIL'}] {label}{(' — ' + detail) if detail else ''}", flush=True)
    return cond


def make_embedding() -> bytes:
    # 결정적 패턴 (서버 stub 과 무관, round-trip 검증용)
    return struct.pack(f"<{EMBED_DIM}f", *[((i % 97) / 97.0) for i in range(EMBED_DIM)])


def go_ble_mode(port: str):
    """팔찌를 BLE 모드로 전환하고 시리얼 핸들을 '열린 채로' 반환.
    USB-CDC 포트를 닫으면 ESP32-C3 가 리셋돼 ESP-NOW 로 되돌아가므로, BLE 테스트가
    끝날 때까지 포트를 열어둔다."""
    try:
        import serial
    except Exception as e:
        print(f"[INFO] pyserial 없음 — GOBLE 생략 ({e})", flush=True)
        return None
    s = serial.Serial(port, 115200, timeout=0.2)
    time.sleep(2.5)            # open 시 리셋될 수 있으니 부팅 대기
    s.reset_input_buffer()
    s.write(b"GOBLE\n"); s.flush()
    time.sleep(1.8)            # 라디오 전환(ESP-NOW deinit + BLE init) 대기
    resp = s.read(256).decode("utf-8", "replace").strip().replace("\r", " ").replace("\n", " ")
    print(f"[INFO] {port} GOBLE → {resp}", flush=True)
    return s   # 열린 채 반환


async def run(args) -> int:
    ser = None if args.no_serial else go_ble_mode(args.port)
    try:
        return await _run_ble(args)
    finally:
        if ser is not None:
            try:
                ser.close()   # 테스트 끝 — 이제 리셋돼도 무방
            except Exception:
                pass


async def _run_ble(args) -> int:
    print(f"[INFO] '{NAME}' 스캔…", flush=True)
    dev = await BleakScanner.find_device_by_name(NAME, timeout=args.scan_timeout)
    if not ok("scan", dev is not None, dev.address if dev else "미발견"):
        return 1

    # Windows: 캐시된 GATT 미사용 (모드 전환마다 GATT 재생성 → services changed 회피)
    try:
        client = BleakClient(dev, winrt={"use_cached_services": False})
    except TypeError:
        client = BleakClient(dev)

    fails = 0
    async with client:
        t0 = time.time()
        ok("connect", client.is_connected, dev.address)

        wid = bytes(await client.read_gatt_char(CHR_ID)).decode("ascii", "replace")
        fails += not ok("read-id", bool(wid), wid)

        flag = bytes(await client.read_gatt_char(CHR_FLAG))
        fails += not ok("read-contact-flag", True, str(bool(flag and flag[0])))

        emb = make_embedding()
        tw = time.time()
        for off in range(0, EMBED_BYTES, CHUNK):
            payload = off.to_bytes(2, "little") + emb[off:off + CHUNK]
            await client.write_gatt_char(CHR_EMB, payload, response=True)
        ok("write-embedding (8 chunks / 2048B)", True, f"{(time.time()-tw)*1000:.0f} ms")

        buf = bytearray(EMBED_BYTES)
        tr = time.time()
        for off in range(0, EMBED_BYTES, CHUNK):
            await client.write_gatt_char(CHR_OFF, off.to_bytes(2, "little"), response=True)
            chunk = bytes(await client.read_gatt_char(CHR_EMB))
            buf[off:off + len(chunk)] = chunk[:CHUNK]
        match = bytes(buf) == emb
        fails += not ok("read-back 2048B 무손실", match, f"{(time.time()-tr)*1000:.0f} ms")

        await client.write_gatt_char(CHR_SEAT, b"A12", response=True)
        seat = bytes(await client.read_gatt_char(CHR_SEAT)).decode("utf-8", "replace")
        fails += not ok("seat write/read", seat == "A12", seat)

        # 서버의 '종료 명령' 재현 — 제어 char write (best-effort)
        try:
            await client.write_gatt_char(CHR_CTRL, b"\x01", response=False)
            print("[INFO] 제어 char(...f7) write — 팔찌 ESP-NOW 복귀 명령", flush=True)
        except Exception as e:
            print(f"[INFO] 제어 char write 예외(무방): {e}", flush=True)

        print(f"\n총 소요 {time.time()-t0:.1f}s", flush=True)

    print(f"\n=> {'ALL PASS ✅ (펌웨어/BLE 정상 — 문제는 서버 컨텍스트)' if fails == 0 else f'{fails} FAIL'}", flush=True)
    return 1 if fails else 0


def main() -> int:
    p = argparse.ArgumentParser(description="팔찌 BLE 독립 테스트")
    p.add_argument("--port", default="COM7", help="팔찌 USB-CDC 포트 (GOBLE 용)")
    p.add_argument("--no-serial", action="store_true", help="시리얼 GOBLE 생략 (이미 BLE 모드)")
    p.add_argument("--scan-timeout", type=float, default=12.0)
    args = p.parse_args()
    try:
        return asyncio.run(run(args))
    except Exception as e:
        print(f"[FAIL] {type(e).__name__}: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
