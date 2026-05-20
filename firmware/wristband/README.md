# 팔찌 펌웨어 — ESP32-C3 + 0.42" OLED

`software/ble_client.py` 의 `RealBLEBackend` 와 짝이 되는 BLE Peripheral.

## 빌드/플래시

```powershell
# PlatformIO Core (한 번만)
pip install -U platformio
# PATH 등록 (선택)
[Environment]::SetEnvironmentVariable("PATH", $env:PATH + ";C:\Users\$env:USERNAME\AppData\Roaming\Python\Python313\Scripts", "User")

# 빌드 & 업로드
cd software\firmware-wristband
pio run -t upload --upload-port COM3
pio device monitor -p COM3 -b 115200
```

> 한글 경로에서 링커가 map 파일 생성에 실패하므로 `platformio.ini` 에서
> `build_dir = C:/pio-builds/wristband` 로 빌드 디렉토리를 ASCII 경로로 옮겨둠.

## 보드 — ESP32-C3 + 0.42" OLED 변종 노트

같은 외형의 보드도 내부 핀/컨트롤러가 다른 변종이 유통됨. 실측 결과:

| 항목 | 본 프로젝트 보드 | 확인 방법 |
|---|---|---|
| I2C 핀 | **SDA=GPIO5, SCL=GPIO6** | `software/i2c-scanner` 펌웨어로 양쪽 핀 쌍 모두 시도 |
| OLED 컨트롤러 | **SSD1306** (0x3C) | SH1106 드라이버는 ACK는 받지만 픽셀이 안 보임 |
| 패널 | 72×40 (128×64 내부 버퍼의 중앙) | `U8G2_SSD1306_72X40_ER_F_HW_I2C` 가 오프셋 자동 처리 |
| 내장 LED | GPIO8 (active-low) | 데모 펌웨어 + 깜빡임 확인 |
| BOOT 버튼 | GPIO9 | 일반적 strapping 핀 |
| MAC 끝 3바이트 | `WB-09AF70` 보드 1대 검증됨 | `ESP.getEfuseMac() & 0xFFFFFF` |

다른 변종으로는 I2C 가 GPIO8/9 인 것도 있다고 보고됨 (Pharkie 데모와 호환 안 됨).
신규 보드 받으면 `software/i2c-scanner` 부터 돌려서 핀/주소 확인할 것.

## USB-CDC 명령 프로토콜 (EntryDevice 와 짝)

`software/entry_device.py` 가 이 포트를 라인 텍스트로 직접 제어한다.

| 명령 | 응답 | 효과 |
|---|---|---|
| `WAKE\n`  | `OK`       | LED 짧게 깜빡 (광고 자체는 noop) |
| `PASS\n`  | `OK`       | LED 0x01 + OLED `L:01` |
| `DENY\n`  | `OK`       | LED 0x02 + OLED `L:02` |
| `CLEAR\n` | `OK`       | 즉시 OK (NFC 태그 없음) |
| `PING\n`  | `OK PONG`  | 헬스체크 |
| 기타      | `ERR UNKNOWN <cmd>` | |

> ⚠ **`pio device monitor` 와 동시 점유 불가** — 같은 USB-CDC 포트라서
> 모니터를 켠 채로는 `EntryDevice.connect()` 가 실패한다. 운영 전 모니터를 닫을 것.

## 컴파일/플래시 시 함정

| 증상 | 원인 | 해결 |
|---|---|---|
| `cannot open map file ...` 링커 에러 | 한글 경로 + MinGW ld.exe UTF-8 미지원 | `build_dir` 를 ASCII 경로로 |
| `Serial was not declared in this scope` | `ARDUINO_USB_CDC_ON_BOOT=1` 만 단독으로 켜면 발생 | `ARDUINO_USB_MODE=1` 도 같이 |
| COM3 잡혔는데 시리얼 출력 없음 | USB CDC 빌드 플래그 누락 | 위 두 플래그 모두 설정 |
| 모니터/다른 프로세스가 COM3 점유 | 업로드 실패 (`Could not open COM3`) | 모니터 창 닫고 USB 재연결 |
| Pharkie OLED 데모가 화면 표시 안 됨 | 보드 컨트롤러가 SSD1306 인데 데모는 SH1106 가정 | 본 펌웨어처럼 U8g2 SSD1306_72X40_ER 사용 |
| `setValue(const char*)` 가 포인터 주소를 쓰는 듯한 데이터 | NimBLE-Arduino 의 템플릿 오버로드 함정 | `setValue(std::string("..."))` 로 명시 |
| 2048B 임베딩 write 시 `Invalid Attribute Value Length` | BLE 단일 attribute 한계 = **512 B** (스펙) | 청킹 (아래 프로토콜) |

## BLE 청킹 프로토콜 (임베딩 전용)

`CHR_EMBEDDING` 의 단일 write 한계 (512 B) 우회. 다른 char 는 직접 R/W.

### Write (호스트 → 팔찌)
```
payload = [u16_le offset][data ≤ 256 B]
```
호스트는 전체 임베딩을 `EMBED_CHUNK=256` 바이트 단위로 잘라 각 chunk 의
시작 오프셋과 함께 순차 write. 펌웨어는 `g_embedding[offset .. offset+len]` 에 복사.

### Read (팔찌 → 호스트)
1. 호스트: `CHR_EMB_OFF` (`...cdef6`) 에 시작 오프셋 (u16_le) write
2. 호스트: `CHR_EMBEDDING` read → 펌웨어가 `g_embedding[offset..offset+256]` 반환
3. 끝까지 반복

`EMBED_DIM=512` (float32) → 2048 B → 8 청크.

`software/ble_client.py` 의 `write_embedding` / `read_embedding` 에 양쪽 구현됨.

## 동작 검증 (2026-05-19 기준)

| 항목 | 결과 |
|---|---|
| BLE 광고 (`FaceTicket-Wristband`) | OK |
| GATT 연결/해제 후 재광고 | OK |
| `CHR_ID` read | `WB-09AF70` |
| `CHR_SEAT` R/W | round-trip OK |
| `CHR_LED` write | 효과 코드 수신, LED 깜빡임 |
| `CHR_FLAG` read | BOOT 버튼 상태 미러 |
| 2048 B 임베딩 청크 R/W | `max_diff = 0` (무손실) |
| OLED 4줄 상태 표시 | `BLE:ADV/CONN`, ID, Seat, LED 코드 |

## 시각화

OLED 4줄 (`u8g2_font_5x7_tf` 5×7 폰트):
- L1: `BLE:ADV` / `BLE:CONN`
- L2: 팔찌 ID (`WB-XXXXXX`, MAC 하위 3바이트)
- L3: 마지막 좌석 (`S:A12` / `S:-`)
- L4: 마지막 LED 효과 코드 (`L:01` / `L:--`)

LED (GPIO8, active-low):
- 광고 중: 1.5 s 마다 짧게 깜빡
- 연결됨: 상시 ON
- LED 효과 write: `code & 0x07` 회 깜빡 후 연결 상태로 복귀
