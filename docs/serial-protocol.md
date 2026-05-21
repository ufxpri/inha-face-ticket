# 시리얼 프로토콜

운영자 장치(Arduino UNO gate 또는 ESP32-C3 팔찌 USB-CDC 직결) ↔ 서버 사이 USB 시리얼 프로토콜. **두 하드웨어 모두 동일한 통합 명령 집합을 구현**한다 — 서버는 어느 쪽이 연결돼 있는지 알 필요가 없다 (LSP).

명령은 한 줄(`\n` 종료) ASCII. 응답도 한 줄 ASCII, `OK` 로 시작하면 성공.

서버 측 구현: `server/src/faceticket/adapters/devices/operator.py` + `serial_io.py` (공통 transport).

## 통합 명령 집합

| 명령  | 응답        | 의미                                                                         |
|---|---|---|
| `WAKE`  | `OK`        | 팔찌 BLE 광고 깨움 (gate 하드웨어: NFC trigger / 팔찌 직결: noop)             |
| `PASS`  | `OK[...]`   | 통과 신호 (gate: 서보 OPEN + 초음파 통과 감지 / 팔찌: LED SUCCESS + OLED PASS) |
| `DENY`  | `OK`        | 거부 신호 (gate: 적색 LED + 잠금 유지 / 팔찌: LED FAILURE + OLED DENY)        |
| `CLEAR` | `OK`        | 반납 후처리 (gate: NFC 영역 0x00 기록 / 팔찌: 상태 초기화)                    |
| `PING`  | `OK PONG`   | 헬스 체크 — `connect` 직후 자동 호출                                          |

`PASS` 응답의 `OK` 뒤 토큰(예: `OK passed` / `OK timeout`)은 디버그용. 서버 코드는 prefix `OK` 만 검사한다.

## 하드웨어별 매핑

### Arduino UNO + NFC writer + 서보 게이트

`firmware/arduino-gate/arduino_uno.ino`. 핀맵: SERVO=9, LED_GREEN=5, LED_RED=6, ULTRA_TRIG=7, ULTRA_ECHO=8.

| 통합 명령 | 내부 동작 |
|---|---|
| `WAKE`  | PN5180 SPI → ST25DV16K EEPROM 에 BLE_TRIGGER 기록 |
| `PASS`  | 녹색 LED + 서보 OPEN (90°) + 초음파 통과 감지(5s) + 서보 CLOSED |
| `DENY`  | 적색 LED 800ms |
| `CLEAR` | PN5180 SPI → NFC 영역 0x00 기록 |
| `PING`  | `OK PONG` |

### ESP32-C3 팔찌 USB-CDC 직결

`firmware/wristband/src/main.cpp`. NFC 없음 (팔찌 자체 광고). 게이트 없음 (LED + OLED 만).

| 통합 명령 | 내부 동작 |
|---|---|
| `WAKE`  | 광고 활성 확인 (noop, OK) |
| `PASS`  | LED SUCCESS 효과 + OLED PASS 화면 |
| `DENY`  | LED FAILURE 효과 + OLED DENY 화면 |
| `CLEAR` | noop (NFC 없음) |
| `PING`  | `OK PONG` |

> ESP32-C3 USB-CDC 는 `pio device monitor` 와 동시 점유 불가. 펌웨어 모니터링 중이면 모니터를 먼저 종료한다.

## SIM 모드

admin UI 에서 포트로 `SIM` 을 입력하면 시리얼 객체 없이 동작. 명령마다 ~150 ms 지연 후 모의 응답.

| 명령 | SIM 응답 |
|---|---|
| `PING` | `OK PONG` |
| 그 외 | `OK` |
