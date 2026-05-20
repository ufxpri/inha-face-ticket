"""시스템 시리얼 포트 검색."""
from __future__ import annotations


def list_serial_ports() -> list[dict]:
    """`pyserial.tools.list_ports.comports()` 결과를 직렬화. pyserial 미설치면 빈 리스트."""
    try:
        from serial.tools import list_ports
    except Exception:
        return []
    out: list[dict] = []
    for p in list_ports.comports():
        vid_pid = ""
        try:
            if p.vid is not None and p.pid is not None:
                vid_pid = f"{p.vid:04X}:{p.pid:04X}"
        except Exception:
            pass
        out.append({"device": p.device, "description": p.description or "", "vid_pid": vid_pid})
    return out
