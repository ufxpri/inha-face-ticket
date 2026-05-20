"""시스템 설정값."""
from pathlib import Path
from typing import Optional

APP_DIR = Path(__file__).parent          # server/app/
SERVER_DIR = APP_DIR.parent              # server/
DB_PATH = SERVER_DIR / "issue.db"
STATIC_DIR = APP_DIR / "web" / "static"
TEMPLATES_DIR = APP_DIR / "web" / "templates"

# ── 운영자 장치 (시리얼) ─────────────────────────────────────
# 두 종류의 독립 장치 중 하나만 동시에 연결.
#   - 발급장치 (IssuanceDevice)  : NFC 라이터 + 게이트 아두이노
#   - 입장장치 (EntryDevice)     : ESP32-C3 팔찌 USB-CDC 직결
# 포트는 admin UI 에서 선택/연결한다. 부팅 시 자동연결을 원하면 아래 두 값을 채울 것.
AUTO_CONNECT_ISSUANCE_PORT: Optional[str] = None  # 예: "COM5"
AUTO_CONNECT_ENTRY_PORT:    Optional[str] = None  # 예: "COM3"
SERIAL_BAUD = 115200

# BLE (True 면 팔찌 펌웨어 없이도 동작하도록 강제 mock)
BLE_MOCK = True
WRISTBAND_NAME = "FaceTicket-Wristband"
SVC_UUID       = "12345678-1234-5678-1234-56789abcdef0"
CHR_EMBEDDING  = "12345678-1234-5678-1234-56789abcdef1"
CHR_SEAT       = "12345678-1234-5678-1234-56789abcdef2"
CHR_FLAG       = "12345678-1234-5678-1234-56789abcdef3"
CHR_LED        = "12345678-1234-5678-1234-56789abcdef4"
CHR_ID         = "12345678-1234-5678-1234-56789abcdef5"
CHR_EMB_OFF    = "12345678-1234-5678-1234-56789abcdef6"  # 청크 read offset 컨트롤
EMBED_CHUNK    = 256                                       # bytes per read/write chunk

# 얼굴 인증 (facenet-pytorch InceptionResnetV1 / vggface2 = 512-d, L2 정규화)
EMBED_DIM = 512
COSINE_THRESHOLD = 0.55     # vggface2 임베딩 동일인 ≈ 0.6~0.9, 타인 ≈ 0.0~0.3 — 캘리브레이션 필요

# 정면도 게이트 (MTCNN 5점 키포인트 기반)
#   이 값을 만족하지 못하면 임베딩 추출을 거부하고 사용자에게 재캡처 메시지 표시.
FRONTAL = {
    "min_prob":   0.95,     # MTCNN 검출 신뢰도 하한
    "max_roll":   15.0,     # 두 눈 잇는 선의 수평 기울기 최대 (°)
    "max_yaw":    0.12,     # 코 / 입중심이 두 눈 중심에서 좌우로 벗어난 비율 (bbox 폭 기준)
    "pitch_min":  0.30,     # 코 수직 위치 = (코y - 눈선y) / (입선y - 눈선y) — 너무 위
    "pitch_max":  0.75,     # 너무 아래
    "min_bbox_ratio": 0.18, # 얼굴 bbox 가로 / 이미지 가로 — 너무 멀면 거부
}

# LED 효과 코드
LED_SUCCESS = 0x01
LED_FAILURE = 0x02
LED_ISSUED  = 0x03
LED_OFF     = 0x00
