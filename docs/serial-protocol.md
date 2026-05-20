# 시리얼 프로토콜

운영자 장치(발급장치 또는 입장장치) ↔ 서버 사이 USB-CDC 시리얼 프로토콜. 한 번에 한 장치만 연결 (`DeviceRegistry` mutex).

명령은 한 줄(`\n` 종료) ASCII. 응답도 한 줄 ASCII, `OK` 로 시작하면 성공.

서버 측 구현: `server/src/faceticket/adapters/devices/{issuance,entry}.py` (얇은 명령 매핑) + `serial_io.py` (공통 transport).

## 발급장치 — Arduino UNO (NFC 라이터 + 게이트 솔레노이드)

펌웨어: `firmware/arduino-gate/arduino_uno.ino`

| 명령 | 응답 | 의미 |
|---|---|---|
| `NFC_WRITE BLE_TRIGGER` | `OK` 또는 `ERR ...` | NFC 태그에 BLE 광고 트리거 write — 팔찌 wake |
| `NFC_CLEAR`             | `OK` 또는 `ERR ...` | NFC 태그 클리어 (반납) |
| `GATE OPEN`             | `OK PASS` / `OK TIMEOUT` / `ERR ...` | 게이트 솔레노이드 열기 + 초음파로 통과 감지 |
| `GATE DENY`             | `OK` | 거부 신호 (LED + 부저, 솔레노이드 잠금 유지) |

## 입장장치 — ESP32-C3 팔찌 USB-CDC 직결

펌웨어: `firmware/wristband/src/main.cpp`. NFC 가 없으므로 `WAKE` 는 디버그 LED 깜빡 트리거. 게이트 솔레노이드 없음 — `PASS` 는 LED SUCCESS + OLED 표시 의미.

| 명령 | 응답 | 의미 |
|---|---|---|
| `WAKE`  | `OK` | 광고 활성화 (이미 광고 중이라 사실상 noop) |
| `PASS`  | `OK` | LED SUCCESS 효과 + OLED PASS 화면 |
| `DENY`  | `OK` | LED FAILURE 효과 + OLED DENY 화면 |
| `CLEAR` | `OK` | 반납 — 팔찌측 후처리 (현 펌웨어는 noop OK) |
| `PING`  | `OK PONG` | 헬스체크 (서버가 connect 직후 한 번 호출) |

**주의**: USB-CDC 포트는 `pio device monitor` 와 동시 점유 불가. 펌웨어 모니터링 중이면 모니터를 먼저 종료할 것.

## SIM 모드

서버 admin UI 에서 포트로 `SIM` 을 입력하면 시리얼 객체 없이 동작. 명령마다 약 100~200 ms 지연 후 모의 응답.

| 명령 | SIM 응답 |
|---|---|
| `GATE OPEN` | `OK PASS` |
| `PING`      | `OK PONG` |
| 그 외       | `OK` |
