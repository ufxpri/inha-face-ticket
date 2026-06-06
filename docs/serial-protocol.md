# 시리얼 프로토콜

운영자 장치 ↔ 서버 사이 USB 시리얼 프로토콜. 운영자 장치는 **NFC 리더 + 입장 게이트** 두 역할로
나뉘고, 서버(`SplitOperatorDevice`)가 명령을 역할별로 **서로 다른 시리얼 포트**에 라우팅한다:

| 명령군 | 역할 | 포트 env | 권장 하드웨어 |
|---|---|---|---|
| `WAKE` / `CLEAR` | **NFC** | `FT_NFC_PORT` | ESP32-C3 + PN5180 |
| `PASS` / `DENY` | **GATE** | `FT_GATE_PORT` | Arduino UNO (서보 + 초음파) |
| `PING` | (각 역할) | — | connect 직후 핸드셰이크 |

각 보드는 **자기 역할의 명령만** 받는다. 따라서 UNO 의 `WAKE`/`CLEAR` placeholder(`ERR NFC_*`)나
ESP32 의 `PASS`/`DENY` 스텁은 분리 운용 시 호출되지 않는다. NFC 리더는 모든 플로우의 진입(wake)
조건이라 미연결 시 절차 시작이 막히고, 게이트는 입장 전용이라 미연결이어도 PASS/DENY 만 graceful
실패한다.

> 통합/SIM 폴백: `FT_OPERATOR_PORT` 하나만 주면 두 역할을 같은 포트에 붙인다(주로 SIM 데모용 —
> 실제 COM 은 같은 포트를 두 번 못 연다). 한 보드가 5개 명령을 모두 구현한다면(예 esp32-pn5180-smoke)
> 이 폴백으로 단일 보드 운용도 가능.

명령은 한 줄(`\n` 종료) ASCII. 응답도 한 줄 ASCII.
서버는 `OK` 단독 또는 실패 토큰이 없는 `OK ...` 만 성공으로 처리한다. `ERR`, `timeout`, `fail`, `failed`, `error` 토큰이 포함된 응답은 실패다.

서버 측 구현: `server/src/faceticket/adapters/devices/operator.py` + `serial_io.py` (공통 transport).

## 통합 명령 집합

| 명령  | 응답        | 의미                                                                         |
|---|---|---|
| `WAKE`  | `OK`        | 팔찌 BLE 광고 깨움 (PN5180 writer: NFC trigger 기록 / 팔찌 직결: noop)         |
| `PASS`  | `OK passed` / `OK timeout` | 통과 신호 (gate: 서보 OPEN + 초음파 통과 감지 / ESP32 PN5180: demo 성공 응답) |
| `DENY`  | `OK`        | 거부 신호                                                                    |
| `CLEAR` | `OK`        | 반납 후처리 (PN5180 writer: NFC 영역 0x00 기록 / 팔찌 직결: 상태 초기화)       |
| `PING`  | `OK PONG`   | 헬스 체크 — `connect` 직후 자동 호출                                          |

`PASS` 응답은 `OK passed` 만 성공으로 본다. `OK timeout` 은 초음파 통과 감지 실패이므로 서버가 실패로 처리한다.

## 하드웨어별 매핑

### ESP32-C3 + PN5180 NFC writer

`firmware/tools/esp32-pn5180-smoke/src/main.cpp`. 레벨 시프터 없이 PN5180을 쓰는 데모 권장 operator 장치다.

| 통합 명령 | 내부 동작 |
|---|---|
| `WAKE`  | PN5180 SPI/RF → ST25DV16K user memory block 8 에 `FTWK` 기록 후 read-back 검증 |
| `PASS`  | 물리 게이트 없이 demo 성공 응답 `OK passed` |
| `DENY`  | `OK` |
| `CLEAR` | PN5180 SPI/RF → ST25DV16K user memory block 8 을 `0x00` 으로 초기화 후 read-back 검증 |
| `PING`  | `OK PONG` |

### Arduino UNO 물리 게이트 스켈레톤

`firmware/arduino-gate/arduino-gate.ino`. 핀맵: SERVO=9, LED_GREEN=5, LED_RED=6, ULTRA_TRIG=7, ULTRA_ECHO=8.

| 통합 명령 | 내부 동작 |
|---|---|
| `WAKE`  | `ERR NFC_WAKE_NOT_IMPLEMENTED` |
| `PASS`  | 녹색 LED + 서보 OPEN (90°) + 초음파 통과 감지(5s) + 서보 CLOSED |
| `DENY`  | 적색 LED 800ms |
| `CLEAR` | `ERR NFC_CLEAR_NOT_IMPLEMENTED` |
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
