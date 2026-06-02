# Hardware

## Bill of Materials

| 구분 | 부품 | 역할 | 수량 | 가격(개당) |
|---|---|---|---|---|
| 팔찌 | **ESP32-C3 SuperMini OLED 보드** (0.42" SSD1306 일체형, 72×40, I²C 0x3C) | MCU + 좌석 표시 | × 4 | ₩4,500 |
| 팔찌 | **ST25DV16K** 동적 NFC 태그 (NFC Type 5 / ISO 15693, 16Kbit EEPROM, I²C 0x2D / 0x53 / 0x57, 256B 메일박스, GPO 인터럽트) | BLE 활성 트리거 | × 4 | ₩5,100 |
| 팔찌 | **TP4056** USB-C 충전 모듈 (DW01A + FS8205A 보호회로, 4.2V 과충전 / 2.4V 과방전 컷오프) | LiPo 충전 + 보호 | × 4 | ₩980 |
| 팔찌 | **DTP652533** 3.7V 500mAh LiPo (1.85Wh, 6.5×25×33mm, KC 인증, Molex 51021-0200 2핀 1.25mm) | 휴대용 전원 | × 4 | ₩3,500 |
| 팔찌 | RGB LED 모듈 (4핀, 내장 저항, 공통 캐소드) | 효과 / 공연 큐 | × 4 | 키트 |
| 팔찌 | 컨택트 스위치 (마이크로/택트) | 체결 유지 감지 (위변조 방어) | × 4 | 키트 |
| 운영자 | **PN5180** NFC 리더 모듈 (NXP, ISO 14443A/B · 15693 · FeliCa, SPI 최대 7Mbit/s) | ST25DV 읽기/쓰기 | × 2 | ₩3,198~₩5,453 |
| 운영자 | **Arduino UNO** | USB-SPI 브리지 + 게이트 액추에이터 제어 | × 2 | 키트 |
| 게이트 | SG90 서보모터 | 차단봉 개폐 (PWM 직접 제어) | × 1 | 키트 |
| 게이트 | HC-SR04 초음파 센서 | 사용자 게이트 통과 감지 | × 1 | 키트 |
| 게이트 | LED | 인증 결과 표시 (허가/거부) | — | 키트 |
| 호스트 | **노트북** (팀 보유) | FastAPI 서버 · 카메라 · 얼굴 인식 · BLE Central | × 2 | — |

**구매 부품 합계**: ESP32-C3 4 + ST25DV16K 4 + PN5180 2 + DTP652533 4 + TP4056 4.

## 부품 호환성 매트릭스

### 전원 경로

```
USB-C 5V ──→ TP4056 IN ──→ DTP652533 LiPo (3.7~4.2V) ──┬──→ ESP32-C3 보드 5V 핀
                                                       │     (온보드 AMS1117 LDO → 3.3V)
                                                       └──→ ST25DV16K Vcc (1.8~5.5V 직결)
```

USB 미연결 시 배터리 3.7~4.2V 로 LDO 구동, USB 연결 시 충전·전원 공급 자동 절체.

### 로직 레벨

| 디바이스 | 로직 전압 | 호환 처리 |
|---|---|---|
| ESP32-C3 GPIO | 3.3V | 기준 |
| ST25DV16K | 1.8~5.5V | 3.3V 직결 가능, SDA/SCL 내장 10kΩ 풀업으로 레벨 시프터 불필요 |
| ST25DV16K GPO | TTL (3.3V) | ESP32-C3 GPIO 인터럽트 직결 가능 |
| Arduino UNO | 5V | 물리 게이트 스켈레톤 전용. PN5180과 직접 연결하지 않음 |
| PN5180 PVDD | 3.3V (로직) | ESP32-C3 ↔ PN5180 SPI 정합 |
| PN5180 VDD | 5V (RF) | 안테나 구동 전류 확보 (PVDD 와 분리) |

### I²C 버스 공유 (팔찌 측)

| 디바이스 | 주소 | 비고 |
|---|---|---|
| OLED (SSD1306) | 0x3C | ESP32-C3 SuperMini 보드 일체형 |
| ST25DV16K user mem | 0x53 | 사용자 EEPROM 영역 |
| ST25DV16K system | 0x57 | 시스템 영역 (GPO/IT 설정) |
| ST25DV16K dyn reg | 0x2D | dynamic register |

주소 충돌 없음. ST25DV16K 가 최대 1MHz I²C 를 지원해 OLED(보통 400kHz) 와 함께 운용해도 병목 없음.

### NFC 프로토콜

| 측면 | 사양 |
|---|---|
| 팔찌 태그 | ST25DV16K — NFC Type 5 / ISO 15693, 13.56MHz |
| 리더 | PN5180 — ISO 14443A/B · **ISO 15693** · FeliCa 멀티 프로토콜 |
| 호환성 | ISO 15693 공통, 완전 호환 |
| 확장성 | iOS 14+ 및 일부 Android 가 ISO 15693 지원 → 향후 스마트폰 리더 전환 여지 |

### BLE

| 측면 | 사양 |
|---|---|
| 팔찌 | ESP32-C3, BLE 5.0 (LE), Peripheral |
| 노트북 | Windows 10/11, macOS 표준 BLE 스택, Central |
| GATT | 단일 service + 6 characteristics — [`ble-protocol.md`](ble-protocol.md) |
| Classic BT | 미지원 (필요 없음) |

### 전력 예산

| 모드 | 전류 (ESP32-C3 + OLED) |
|---|---|
| Deep sleep (GPO 인터럽트 대기) | 수십 µA |
| BLE 활성 (광고/연결) | 80~120 mA |
| OLED 포함 피크 | ~150 mA |

DTP652533 500 mAh 기준, 평시 sleep 위주 + BLE 단속적 활성으로 단일 공연(2~3h) 운용 가능.

## 회로도

각 장치 회로도(전자 팔찌 / 발급·반납 장치 / 입장 게이트 장치)는 11주차 활동 보고서(`11주차 활동 보고서.html`) 의 §3 부품 선정 섹션에 canvas 렌더링으로 첨부.

## 펌웨어 빌드

```bash
# ESP32-C3 팔찌 (PlatformIO)
cd firmware/wristband
pio run -t upload && pio device monitor

# Arduino UNO (게이트 스켈레톤)
# Arduino IDE 또는 arduino-cli 로 firmware/arduino-gate/arduino-gate.ino 업로드
```

`firmware/wristband/platformio.ini` 는 PlatformIO 기본 빌드 디렉터리(`.pio/build`)를 사용한다. OS별 절대 경로를 두지 않아 macOS/Windows 모두 같은 설정으로 빌드할 수 있다.

Arduino UNO 스케치는 서보 게이트(`PASS`/`DENY`) 시퀀스만 유지한다. 레벨 시프터 없이 PN5180을 UNO에 직접 연결하지 않기 위해 `WAKE`/`CLEAR` 는 `ERR NFC_*_NOT_IMPLEMENTED` 를 반환하는 fail-closed placeholder 다.

PN5180 기반 NFC `WAKE`/`CLEAR` 는 `firmware/tools/esp32-pn5180-smoke` 의 ESP32-C3 firmware 를 사용한다. 이 firmware 는 ST25DV16K user memory block 8 에 `FTWK` 기록/초기화를 수행하고, 서버 operator 계약용 `PASS`/`DENY` 응답도 제공한다.

업로드 직후 smoke test 절차는 [`hardware-smoke-test.md`](hardware-smoke-test.md) 를 따른다. CLI 헬퍼는 `scripts/hardware-smoke-test.py` 에 있다.
