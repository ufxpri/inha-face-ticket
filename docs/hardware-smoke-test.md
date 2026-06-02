# Hardware Smoke Test

실기기 업로드 직후 서버 전체 플로우를 돌리기 전에, 펌웨어와 호스트 사이의 최소 통신 계약만 확인하는 절차다.

## 준비

- 서버 가상환경에 `pyserial`, `bleak` 이 설치돼 있어야 한다. `scripts/run-dev.sh` 를 한 번 실행했거나 `server/requirements.txt` 를 설치했다면 준비된 상태다.
- 아래 명령은 repo root 에서 `server/.venv/bin/python` 으로 실행하는 기준이다. 가상환경을 이미 활성화했다면 `python` 으로 바꿔도 된다.
- `pio device monitor`, Arduino IDE Serial Monitor, 서버 프로세스가 같은 serial 포트를 점유하고 있으면 먼저 종료한다.
- Arduino `PASS` 는 서보를 움직이고 초음파 통과 감지를 기다린다. 게이트 주변을 비운 뒤 실행한다.
- Arduino UNO 스케치의 `WAKE`/`CLEAR` 는 레벨 시프터 없는 PN5180 연결을 피하기 위해 fail-closed placeholder 다. 실제 ST25DV16K `WAKE`/`CLEAR` 는 ESP32-C3 + PN5180 firmware 로 확인한다.

## 포트 확인

```bash
server/.venv/bin/python scripts/hardware-smoke-test.py list-serial
```

macOS 에서는 보통 `/dev/cu.usbmodem*` 또는 `/dev/cu.usbserial*` 형태다.

## ESP32-C3 팔찌 빌드/업로드

```bash
cd firmware/wristband
pio run
pio run -t upload --upload-port /dev/cu.usbmodemXXXX
pio device monitor --port /dev/cu.usbmodemXXXX
```

모니터에서 `FaceTicket-Wristband` 초기화 로그와 USB-CDC `PING` 응답을 확인할 수 있다. BLE smoke test 를 실행할 때는 serial monitor 를 종료한다.

## Arduino UNO 게이트 스켈레톤 빌드/업로드

```bash
arduino-cli compile --fqbn arduino:avr:uno firmware/arduino-gate
arduino-cli upload --fqbn arduino:avr:uno -p /dev/cu.usbmodemXXXX firmware/arduino-gate
```

스케치 폴더와 메인 파일명은 Arduino CLI 규칙에 맞게 `firmware/arduino-gate/arduino-gate.ino` 로 맞춰져 있다.

## Serial Smoke Test

Arduino UNO 기본 확인:

```bash
server/.venv/bin/python scripts/hardware-smoke-test.py serial \
  --target arduino \
  --port /dev/cu.usbmodemXXXX \
  --expect-nfc-placeholder
```

기대 결과:

- `PING` -> `OK PONG`
- `DENY` -> `OK`
- `WAKE` -> `ERR NFC_WAKE_NOT_IMPLEMENTED`
- `CLEAR` -> `ERR NFC_CLEAR_NOT_IMPLEMENTED`

`--expect-nfc-placeholder` 는 `WAKE`/`CLEAR` 의 placeholder `ERR` 응답을 정상 기대값으로 판정한다.

태그 없이 Arduino serial 연결만 확인:

```bash
server/.venv/bin/python scripts/hardware-smoke-test.py serial \
  --target arduino \
  --port /dev/cu.usbmodemXXXX \
  --commands PING DENY
```

게이트 통과 감지까지 확인하려면 `PASS` 를 명시적으로 포함한다.

```bash
server/.venv/bin/python scripts/hardware-smoke-test.py serial \
  --target arduino \
  --port /dev/cu.usbmodemXXXX \
  --include-pass
```

`PASS` 성공 기대값은 `OK passed` 다. 사람이 지나가지 않거나 초음파 감지가 실패하면 `OK timeout` 이 나오며, 서버와 smoke test 모두 실패로 처리한다.
Arduino 스케치의 통과 감지 대기 시간이 5초이므로 서버와 smoke test 는 `PASS` 명령에 한해 기본 7초까지 응답을 기다린다. smoke test 값은 `--pass-timeout` 으로 조정한다.

ESP32-C3 팔찌 USB-CDC 직결 명령도 같은 스크립트로 확인할 수 있다.

```bash
server/.venv/bin/python scripts/hardware-smoke-test.py serial \
  --target esp32 \
  --port /dev/cu.usbmodemXXXX \
  --commands PING DENY WAKE CLEAR
```

ESP32-C3 팔찌 직결 모드에서는 `WAKE`/`CLEAR` 가 noop 이므로 `OK` 가 정상 기대값이다.

## BLE Smoke Test

읽기 전용 기본 확인:

```bash
server/.venv/bin/python scripts/hardware-smoke-test.py ble
```

기대 결과:

- `FaceTicket-Wristband` 광고 검색 성공
- BLE connect 성공
- wristband ID 읽기 성공
- contact flag 가 `False`

BOOT 버튼을 누른 상태이거나 현재 임시 contact flag 회로가 활성 상태면 `read-contact-flag` 가 실패한다. 임시로 플래그 상태만 무시하려면 `--allow-contact-flag` 를 붙인다.

GATT write/read 최소 확인:

```bash
server/.venv/bin/python scripts/hardware-smoke-test.py ble \
  --seat SMOKE-01 \
  --led issued \
  --write-embedding
```

이 명령은 팔찌의 seat, LED, embedding 영역을 smoke-test 값으로 덮어쓴다. 실제 발급 데이터가 들어간 팔찌에는 실행하지 않는다.

## 문제 해결

- serial 응답이 비어 있으면 포트가 맞는지, 다른 모니터가 점유 중인지 확인한다.
- Arduino 연결 직후 `READY` 가 보이는 것은 정상이다. smoke test 는 시작 시 startup line 을 비우고 그 뒤 명령 응답을 판정한다.
- ESP32-C3 + PN5180 에서 `WAKE`/`CLEAR` 가 `ERR NFC_READER_FAILED` 를 반환하면 PN5180 이 SPI/BUSY handshake 에 응답하지 않는 상태다. PN5180 전원, GND 공통, `NSS=GPIO10`, `MOSI=GPIO7`, `MISO=GPIO3`, `SCK=GPIO4`, `BUSY=GPIO20`, `RST=GPIO21` 배선을 먼저 확인한다.
- `WAKE`/`CLEAR` 가 `ERR NFC_RF_FAILED` 를 반환하면 PN5180 과는 SPI 통신이 됐지만 RF field enable 이 실패한 상태다. PN5180 `VDD`/`PVDD` 전원과 안테나 연결을 확인한다.
- `WAKE`/`CLEAR` 가 `ERR NFC_NO_TAG` 를 반환하면 리더는 동작하지만 ST25DV16K 태그가 감지되지 않은 상태다. 팔찌 태그를 PN5180 안테나 중앙에 가까이 댄다.
- BLE scan 이 실패하면 ESP32-C3가 업로드 후 재부팅됐는지, serial monitor 가 BLE 동작을 방해하지 않는지, macOS Bluetooth 권한이 허용됐는지 확인한다.
- `verify-embedding@...` 이 실패하면 BLE chunk write/read 계약이 깨진 것이다. `docs/ble-protocol.md` 와 `firmware/wristband/src/main.cpp` 의 UUID/chunk 크기를 같이 확인한다.

## ESP32-C3 분리형 NFC Smoke Test

레벨 시프터 없이 PN5180을 테스트하려면 Arduino 대신 ESP32-C3 보드에 PN5180을 연결한다. Arduino gate 스케치는 그대로 두고, 아래 독립 테스트 펌웨어만 사용한다.

### ESP32-C3 + PN5180

배선:

| PN5180 | ESP32-C3 OLED |
|---|---|
| `5V` | `5V` |
| `3.3V` | `3.3V` |
| `GND` | `GND` |
| `NSS` | `GPIO10` |
| `MOSI` | `GPIO7` |
| `MISO` | `GPIO3` |
| `SCK` | `GPIO4` |
| `BUSY` | `GPIO20` |
| `RST` / `RTS` | `GPIO21` |
| `IRQ`, `GPIO`, `AUX`, `REQ` | 미연결 |

업로드:

```bash
cd firmware/tools/esp32-pn5180-smoke
pio run -t upload --upload-port /dev/cu.usbmodemXXXX
pio device monitor --port /dev/cu.usbmodemXXXX
```

모니터에서 한 줄씩 입력:

```text
PING
STATUS
RFON
RFOFF
INVENTORY
WAKE
CLEAR
```

`RFON` 이 `OK` 이면 PN5180 RF field enable까지 성공이다. ST25DV16K 태그가 PN5180 안테나 위에 있으면 `INVENTORY` 는 `OK UID=...`, `WAKE`/`CLEAR` 는 `OK` 여야 한다.

서버 operator 계약 전체를 CLI로 확인:

```bash
server/.venv/bin/python scripts/hardware-smoke-test.py serial \
  --target esp32 \
  --operator \
  --port /dev/cu.usbmodemXXXX
```

`--operator` 는 `PING`, `DENY`, `WAKE`, `CLEAR`, `PASS` 를 실행한다. `WAKE`/`CLEAR` 는 ST25DV16K 태그가 PN5180 안테나 위에 있어야 성공하고, `PASS` 는 물리 게이트 없이 `OK passed` 를 반환한다.

### ESP32-C3 + ST25DV16K

배선:

| ST25DV16K | ESP32-C3 OLED |
|---|---|
| `VCC` | `3.3V` |
| `GND` | `GND` |
| `SDA` | `GPIO5` |
| `SCL` | `GPIO6` |
| `GPO` | 미연결 |

업로드:

```bash
cd firmware/tools/st25dv16k-i2c-smoke
pio run -t upload --upload-port /dev/cu.usbmodemYYYY
pio device monitor --port /dev/cu.usbmodemYYYY
```

모니터에서 한 줄씩 입력:

```text
PING
SCAN
READ8
WAKE
READ8
CLEAR
READ8
```

기대값:

- `SCAN` 에 `0x53`, `0x57`, `0x2D` 중 연결된 ST25DV16K 주소가 보여야 한다.
- `WAKE` 후 `READ8` 은 `BLOCK8=4654574B` (`FTWK`) 여야 한다.
- `CLEAR` 후 `READ8` 은 `BLOCK8=00000000` 이어야 한다.

두 보드를 동시에 쓰는 RF/I2C 교차 확인:

1. ST25DV16K 보드에서 `CLEAR`, `READ8` 로 block 8 이 `00000000` 인지 확인한다.
2. ST25DV16K 태그를 PN5180 안테나 위에 둔다.
3. PN5180 보드에서 `WAKE` 를 실행한다.
4. ST25DV16K 보드에서 `READ8` 을 다시 실행해 `4654574B` 가 보이는지 확인한다.

## 서버 E2E Demo Smoke Test

위 serial/BLE 단품 smoke test 가 통과한 뒤, 실제 FastAPI 서버와 WebSocket flow 를 함께 검증한다. 이 절차는 브라우저 UI 대신 `scripts/e2e-demo-smoke.py` 가 admin/tablet WebSocket 을 직접 구동한다.

전제:

- ESP32-C3 + PN5180 firmware 가 operator 보드에 업로드되어 있다.
- ESP32-C3 wristband firmware 가 팔찌 보드에 업로드되어 있다.
- ST25DV16K 태그가 PN5180 안테나 중앙에 놓여 있다.
- `pio device monitor`, Arduino Serial Monitor, 기존 서버 프로세스가 두 serial 포트를 점유하지 않는다.

예시 포트:

| 역할 | 포트 |
|---|---|
| ESP32-C3 + PN5180 operator | `/dev/cu.usbmodem1101` |
| ESP32-C3 wristband BLE | `/dev/cu.usbmodem1201` |

서버 실행:

```bash
FT_SSL=0 \
FT_FACE_STUB=1 \
FT_BLE_MOCK=0 \
FT_OPERATOR_PORT=/dev/cu.usbmodem1101 \
FT_PORT=8765 \
server/.venv/bin/python server/run.py
```

다른 터미널에서 E2E smoke test 실행:

```bash
server/.venv/bin/python scripts/e2e-demo-smoke.py \
  --base-url http://127.0.0.1:8765
```

이 스크립트는 다음 순서로 진행한다:

1. admin/tablet WebSocket 연결
2. `issue_start` → tablet capture trigger → deterministic image payload 전송 → `issue_tag`
3. `entry_start` → `entry_tag` → tablet capture trigger → 같은 image payload 전송
4. `return_start` → `return_tag`

성공 기대값:

- 발급 `complete`: `ok=true`, `flow=issue`, `wristband_id=...`, `seat=...`
- 입장 `complete`: `ok=true`, `flow=entry`, `msg=통과`, `similarity=1.0`
- 반납 `complete`: `ok=true`, `flow=return`, `returned=true`
- DB 에 새 `issues` row 가 생기고, 반납 후 `returned_at` 이 채워진다.

주의:

- `FT_FACE_STUB=1` 은 같은 image payload 를 같은 임베딩으로 만들기 위한 데모 smoke 설정이다. 실제 카메라/FaceNet 검증은 `FT_FACE_STUB=0` 으로 별도 수행한다.
- `complete` 메시지는 현재 서버 구현상 tablet WebSocket 으로 broadcast 된다. admin WebSocket 은 `state=done`/`state=idle` 과 log 를 받는다.
- 기본 seat 는 `E2E-<HHMMSS>` 로 자동 생성된다. 고정 seat 를 쓰려면 `--seat E2E-01` 을 지정한다.
