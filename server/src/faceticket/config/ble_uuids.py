"""BLE GATT 정의 — 펌웨어 (`firmware/wristband/src/main.cpp`) 와 정확히 일치해야 한다.

여기 값을 변경하면 펌웨어도 같이 갱신할 것. 그렇지 않으면 연결만 되고 read/write 가 침묵 실패한다.
"""
from __future__ import annotations

WRISTBAND_NAME: str = "FaceTicket-Wristband"
SVC_UUID:      str = "12345678-1234-5678-1234-56789abcdef0"
CHR_EMBEDDING: str = "12345678-1234-5678-1234-56789abcdef1"
CHR_SEAT:      str = "12345678-1234-5678-1234-56789abcdef2"
CHR_FLAG:      str = "12345678-1234-5678-1234-56789abcdef3"
CHR_LED:       str = "12345678-1234-5678-1234-56789abcdef4"
CHR_ID:        str = "12345678-1234-5678-1234-56789abcdef5"
CHR_EMB_OFF:   str = "12345678-1234-5678-1234-56789abcdef6"
# 모드 전환 control char — write → 팔찌가 BLE 종료 후 ESP-NOW 모드로 복귀.
CHR_CTRL:      str = "12345678-1234-5678-1234-56789abcdef7"

EMBED_CHUNK: int = 256
