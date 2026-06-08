# 핀맵 / 배선 명세 (최종)

오프라인 얼굴인증 전자티켓 시스템의 3개 장치 최종 핀 매핑. 펌웨어 소스가 ground truth다.

| 장치 | MCU | 펌웨어 | 시리얼 |
|---|---|---|---|
| [팔찌 (Wristband)](#1-팔찌-wristband) | ESP32-C3 (0.42" OLED 보드) | `firmware/wristband` | USB-CDC 115200 |
| [NFC 리더 (NFC Reader)](#2-nfc-리더-nfc-reader) | ESP32-C3 (0.42" OLED 보드) + PN5180 | `firmware/tools/esp32-pn5180-smoke` | USB-CDC 115200 |
| [입장 게이트 (Entry Gate)](#3-입장-게이트-entry-gate) | Arduino UNO | `firmware/arduino-gate` | UART 115200 |

> SVG 배선도: [`wristband.svg`](wristband.svg) · [`nfc-reader.svg`](nfc-reader.svg) · [`entry-gate.svg`](entry-gate.svg)

ESP32-C3 GPIO 핀은 **3.3V 로직**. 게이트(UNO)는 **5V 로직**. 두 ESP32-C3 보드는 동일 모델(내장 0.42" 72x40 SSD1306 OLED, I2C SDA=GPIO5/SCL=GPIO6).

---

## 1. 팔찌 (Wristband)

ESP32-C3 + ST25DV(NFC 태그) + RGB LED + 내장 OLED. 무선: BLE(주변장치) ↔ ESP-NOW(수신) 모드 전환.

| GPIO | 방향 | 연결 | 비고 |
|---|---|---|---|
| GPIO5 | I/O | I2C **SDA** (공유 버스) | OLED(0x3C) + ST25DV(0x53/0x57/0x2D) |
| GPIO6 | I/O | I2C **SCL** (공유 버스) | 〃 |
| GPIO7 | IN  | ST25DV **GPO** 인터럽트 | FALLING — RF 쓰기(NFC 태그) 감지 → BLE 전환 |
| GPIO2 | OUT | RGB LED **R** | active-high, 직렬 저항 ~330Ω, 공통 캐소드→GND |
| GPIO1 | OUT | RGB LED **G** | 〃 |
| GPIO0 | OUT | RGB LED **B** | 〃 |
| GPIO8 | OUT | 보드 내장 LED | active-**low** (HIGH=OFF) |
| GPIO9 | IN  | BOOT 버튼 | INPUT_PULLUP — 체결(분리) 플래그 시뮬레이션 |
| 3V3 / GND | PWR | ST25DV·OLED·RGB 전원/그라운드 | 외부전원 운용 시 배터리→3V3 |

- OLED는 보드 내장(같은 I2C 버스). ST25DV는 RF 안테나 필요(NFC 리더와 근접 통신).
- ST25DV는 I2C(MCU)와 RF(리더) 듀얼 인터페이스. 부팅 시 MCU가 자기 BLE 주소를 ST25DV user 블록4-5에 기록 → 리더가 RF로 read(주소 핸드오프).
- 무선: 별도 핀 없음 (온칩 2.4GHz BLE/WiFi).

```
                ESP32-C3 (Wristband)
        ┌─────────────────────────────┐
 SDA 5 ─┤ I2C ┬───────── OLED 0.42" (0x3C, 내장)
 SCL 6 ─┤     └───────── ST25DV (0x53/57/2D) ─── RF 안테나 ~~~)))
 GPO 7 ←┤ INT ←──────────ST25DV GPO
   2 R ─┤ RGB ─[330Ω]─►|─┐
   1 G ─┤ RGB ─[330Ω]─►|─┼─ 공통캐소드 → GND
   0 B ─┤ RGB ─[330Ω]─►|─┘
   8   ─┤ 내장 LED (active-low)
   9   ←┤ BOOT 버튼 (PULLUP) → 체결 플래그
 3V3/GND┤ 전원
        └─────────────────────────────┘
```

---

## 2. NFC 리더 (NFC Reader)

ESP32-C3 + PN5180(ISO15693 RF) + 내장 OLED. wake(태그 write/read) + ESP-NOW RGB 송신 담당.

| GPIO | 방향 | PN5180 핀 | 비고 |
|---|---|---|---|
| GPIO10 | OUT | **NSS** (SPI CS) | |
| GPIO7  | OUT | **MOSI** | SPI |
| GPIO3  | IN  | **MISO** | SPI |
| GPIO4  | OUT | **SCK**  | SPI, 125 kHz |
| GPIO20 | IN  | **BUSY** | PN5180 처리중 신호 |
| GPIO21 | OUT | **RST**  | 리셋 |
| GPIO5  | I/O | (내장 OLED SDA) | SSD1306 0x3C, 디버그 화면 |
| GPIO6  | I/O | (내장 OLED SCL) | 〃 |
| 5V / 3V3 / GND | PWR | PN5180 전원 | PN5180은 5V(RF)+3.3V(로직)+GND 모두 필요 |

- PN5180 IRQ/AUX/GPIO/REQ 핀은 미사용(폴링 방식).
- PN5180 SPI는 OLED I2C(5/6)와 겹치지 않음.
- 무선: ESP-NOW(채널 6) 브로드캐스트로 팔찌 RGB 송신 — 별도 핀 없음.

```
              ESP32-C3 (NFC Reader)           PN5180 (ISO15693)
       ┌───────────────────────────┐        ┌──────────────────┐
 NSS 10─┤ SPI CS ───────────────────┼────────┤ NSS              │
 MOSI 7─┤ SPI ──────────────────────┼────────┤ MOSI    RF 안테나│~~~)))  ← 팔찌 ST25DV
 MISO 3←┤ SPI ──────────────────────┼────────┤ MISO        ___  │
 SCK  4─┤ SPI ──────────────────────┼────────┤ SCK              │
 BUSY 20←┤ ─────────────────────────┼────────┤ BUSY             │
 RST 21─┤ ─────────────────────────┼────────┤ RST              │
        │                           │  5V/3V3/GND ── 전원 ──────┤
 SDA 5 ─┤ I2C ── OLED 0.42"(내장)   │        └──────────────────┘
 SCL 6 ─┤                           │
        └───────────────────────────┘   ((( ESP-NOW ch6 → 팔찌 RGB
```

---

## 3. 입장 게이트 (Entry Gate)

Arduino UNO + 서보(차단바) + 초음파(통과 감지) + 통과/거부 LED. 서버가 PASS/DENY 명령 전송.

| 핀 | 방향 | 연결 | 비고 |
|---|---|---|---|
| D9 | OUT(PWM) | 서보 **신호** | 닫힘 0° / 열림 90° |
| D5 | OUT | **초록 LED** (통과) | 직렬 저항 ~220Ω → GND |
| D6 | OUT | **빨강 LED** (거부) | 〃 |
| D7 | OUT | 초음파 **Trig** | HC-SR04 |
| D8 | IN  | 초음파 **Echo** | HC-SR04 (5V 로직, UNO 직결 OK) |
| 5V / GND | PWR | 서보·HC-SR04·LED 전원 | 서보 전류 크면 외부 5V 권장(공통 GND) |

```
                 Arduino UNO (Gate)
        ┌───────────────────────────┐
   D9  ─┤ PWM ──────── 서보 신호 (열림90°/닫힘0°)
   D5  ─┤ ──[220Ω]──►|── 초록 LED (PASS) → GND
   D6  ─┤ ──[220Ω]──►|── 빨강 LED (DENY) → GND
   D7  ─┤ ──────────── HC-SR04 Trig
   D8  ←┤ ──────────── HC-SR04 Echo
  5V/GND┤ ──────────── 서보 / HC-SR04 / LED 전원
        └───────────────────────────┘
```

---

## 공통 주의
- 두 ESP32-C3는 **같은 보드**라 SDA=5/SCL=6/내장 OLED가 동일. 펌웨어만 다름.
- ESP32-C3 GPIO 절대최대 정격 주의(전류 ~12mA/핀 권장) — RGB LED·서보는 저항/외부전원 사용.
- 서보·HC-SR04는 5V. ESP32-C3 측엔 5V 부품 없음(PN5180만 5V, 자체 레귤레이터).
- ST25DV ↔ PN5180은 **RF(13.56MHz)** 근접 통신 — 안테나 정렬 필요.
