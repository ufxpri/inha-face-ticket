"""LED 효과 코드 — 팔찌 펌웨어 `CHR_LED` 1-byte payload 값."""
from __future__ import annotations

LED_OFF:     int = 0x00
LED_SUCCESS: int = 0x01     # 입장 통과
LED_FAILURE: int = 0x02     # 인증 실패 / 분리 감지
LED_ISSUED:  int = 0x03     # 발급 완료
