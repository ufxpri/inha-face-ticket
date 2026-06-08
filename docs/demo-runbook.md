# Final Demo Runbook

최종 시연 당일에 따라갈 순서다. 목표는 **ESP32-C3 + PN5180 operator, ESP32-C3 wristband BLE, 실제 카메라/FaceNet, FastAPI 서버**를 한 번에 묶어 발급 → 입장 → 반납을 안정적으로 시연하는 것이다.

## 현재 데모 구성

| 역할 | 장치/펌웨어 | 비고 |
|---|---|---|
| Operator NFC writer | ESP32-C3 OLED + PN5180, `firmware/tools/esp32-pn5180-smoke` | 서버의 `FT_OPERATOR_PORT` 에 연결. `WAKE`, `CLEAR`, `PASS`, `DENY` 지원 |
| Wristband | ESP32-C3 OLED + wristband firmware, `firmware/wristband` | BLE peripheral. 임베딩, 좌석, contact flag, LED GATT 제공 |
| NFC tag | ST25DV16K | PN5180 안테나 중앙에 올려 `WAKE`/`CLEAR` write/read-back 확인 |
| Gate skeleton | Arduino UNO, `firmware/arduino-gate` | 레벨 시프터가 없으므로 PN5180과 직접 연결하지 않음. `WAKE`/`CLEAR` 는 fail-closed placeholder |
| Server | FastAPI + bleak + pyserial + FaceNet | admin/tablet WebSocket, SQLite 기록 |

검증된 예시 포트:

| 포트 | 역할 |
|---|---|
| `/dev/cu.usbmodem1101` | ESP32-C3 + PN5180 operator |
| `/dev/cu.usbmodem1201` | ESP32-C3 wristband BLE |

포트 번호는 재연결할 때 바뀔 수 있으므로 매번 `list-serial` 로 다시 확인한다.

## 데모 전 체크리스트

- 노트북 Bluetooth 가 켜져 있다.
- macOS 브라우저/터미널 Bluetooth 권한이 허용되어 있다.
- `pio device monitor`, Arduino Serial Monitor, 이전 서버 프로세스가 serial 포트를 점유하지 않는다.
- ST25DV16K 태그가 PN5180 안테나 중앙에 놓여 있다.
- 태블릿과 노트북이 같은 네트워크에 있다.
- FaceNet 모델 캐시가 준비되어 있다. 처음 실행하는 환경이면 온라인 상태에서 한 번 모델 로딩을 끝내둔다.
- 태블릿 브라우저에서 self-signed HTTPS 인증서 경고를 허용할 준비가 되어 있다.

## 1. 포트 확인

repo root 에서 실행:

```bash
server/.venv/bin/python scripts/hardware-smoke-test.py list-serial
```

예상:

```text
/dev/cu.usbmodem1101    USB JTAG/serial debug unit
/dev/cu.usbmodem1201    USB JTAG/serial debug unit
```

어느 보드가 어떤 역할인지 헷갈리면 각 보드에 펌웨어를 다시 업로드해서 역할을 고정한다.

## 2. 펌웨어 업로드

### ESP32-C3 + PN5180 operator

```bash
cd firmware/tools/esp32-pn5180-smoke
pio run -t upload --upload-port /dev/cu.usbmodem1101
cd ../../..
```

### ESP32-C3 wristband BLE

```bash
cd firmware/wristband
pio run -t upload --upload-port /dev/cu.usbmodem1201
cd ../..
```

업로드 후 `pio device monitor` 는 종료한다. 서버와 smoke test 가 같은 serial 포트를 열어야 한다.

## 3. Hardware Smoke Test

### Operator serial 계약 확인

ST25DV16K 태그를 PN5180 안테나 중앙에 올린 상태에서:

```bash
server/.venv/bin/python scripts/hardware-smoke-test.py serial \
  --target esp32 \
  --operator \
  --port /dev/cu.usbmodem1101
```

기대값:

- `PING`: `OK PONG`
- `DENY`: `OK`
- `WAKE`: `OK`
- `CLEAR`: `OK`
- `PASS`: `OK passed`

### Wristband BLE 계약 확인

```bash
server/.venv/bin/python scripts/hardware-smoke-test.py ble \
  --seat SMOKE-01 \
  --led issued \
  --write-embedding
```

기대값:

- BLE scan/connect 성공
- `read-id` 성공
- `read-contact-flag: False`
- `write-seat`, `write-led` 성공
- `verify-embedding@0`, `verify-embedding@1792` 성공

## 4. Stub E2E Smoke Test

실제 카메라/FaceNet 전에 서버, WebSocket, BLE, PN5180, DB 흐름만 먼저 확인한다. 이 단계는 `FT_FACE_STUB=1` 로 같은 dummy image payload 를 사용하므로 입장 유사도는 `1.0` 이 나와야 한다.

터미널 1:

```bash
FT_SSL=0 \
FT_FACE_STUB=1 \
FT_BLE_MOCK=0 \
FT_OPERATOR_PORT=/dev/cu.usbmodem1101 \
FT_PORT=8765 \
server/.venv/bin/python server/run.py
```

터미널 2:

```bash
server/.venv/bin/python scripts/e2e-demo-smoke.py \
  --base-url http://127.0.0.1:8765
```

기대값:

- `[PASS] issue`
- `[PASS] entry` with `similarity: 1.0`
- `[PASS] return` with `returned: true`

완료 후 터미널 1의 서버를 `Ctrl+C` 로 종료한다.

## 5. 실제 카메라/FaceNet Smoke Test

이 단계가 최종 데모 최소 경로다. 실제 브라우저 UI와 태블릿 카메라를 사용한다.

서버 실행:

```bash
FT_SSL=1 \
FT_FACE_STUB=0 \
FT_BLE_MOCK=0 \
FT_OPERATOR_PORT=/dev/cu.usbmodem1101 \
FT_PORT=4443 \
server/.venv/bin/python server/run.py
```

브라우저:

- Admin: `https://<노트북-LAN-IP>:4443/admin`
- Tablet: `https://<노트북-LAN-IP>:4443/tablet`

브라우저에서 self-signed 인증서 경고를 허용하고, tablet 화면에서 카메라 권한을 허용한다.

Admin 상태에서 확인:

- `ble_mock=false`
- `ml=true`
- `face_available=true`
- operator device connected
- tablet client connected

실제 플로우:

1. Admin 에서 발급 시작. 좌석과 이름을 입력한다.
2. Tablet 에서 얼굴을 정면, 밝은 조명, 프레임 중앙에 맞춰 캡처한다.
3. ST25DV16K 태그가 PN5180 안테나 중앙에 있는지 확인하고 Admin 에서 태그 단계를 진행한다.
4. 발급 완료를 확인한다.
5. Admin 에서 입장 시작 후 태그 단계를 진행한다.
6. 같은 사람이 Tablet 에서 다시 얼굴을 캡처한다.
7. 입장 완료와 similarity 가 threshold 이상인지 확인한다.
8. Admin 에서 반납 시작 후 태그 단계를 진행한다.
9. 반납 완료를 확인한다.

기대값:

- 발급 완료: wristband id 와 seat 가 표시된다.
- 입장 완료: `통과`, similarity >= `0.55`.
- 반납 완료: DB active row 의 `returned_at` 이 채워진다.

## 6. DB 확인

```bash
sqlite3 server/issue.db \
  "select id,wristband_id,seat,name,issued_at,returned_at from issues order by id desc limit 5;"
```

반납까지 끝난 row 는 `returned_at` 이 비어 있지 않아야 한다.

## 빠른 복구표

| 증상 | 원인 후보 | 조치 |
|---|---|---|
| serial 응답이 비어 있음 | monitor/server 가 포트 점유 | `pio device monitor`, 기존 서버 종료 후 재시도 |
| `ERR NFC_NO_TAG` | 태그 위치 불량 | ST25DV16K 를 PN5180 안테나 중앙에 밀착 |
| `ERR NFC_RF_FAILED` | PN5180 RF 전원/안테나 문제 | `5V`, `3.3V`, `GND`, 안테나 연결 확인 |
| BLE scan 실패 | wristband firmware 미업로드, Bluetooth 권한 문제 | wristband 재업로드, macOS Bluetooth 권한 확인 |
| `read-contact-flag: True` | BOOT 버튼 눌림 또는 contact flag 활성 | 버튼에서 손을 떼고 재시도. 임시 확인만 할 때는 `--allow-contact-flag` |
| `ml=false` 또는 `face_available=false` | FaceNet 의존성/모델 캐시 문제 | `server/.venv/bin/pip install -e "server[ml]"` 또는 모델 캐시 준비 |
| 태블릿 카메라가 안 열림 | HTTPS/권한 문제 | `FT_SSL=1`, 인증서 경고 허용, 카메라 권한 허용 |
| similarity 낮음 | 얼굴 각도/조명/거리 문제 | 정면, 밝은 조명, 얼굴 크게, 같은 사람으로 재시도 |
| 좌석 중복/팔찌 중복 실패 | 이전 active row 남음 | 먼저 반납 플로우를 수행하거나 DB 상태 확인 |

## 데모 종료

1. 서버를 `Ctrl+C` 로 종료한다.
2. 로그에 operator serial 해제 메시지가 나오는지 확인한다.
3. 필요하면 DB 최신 row 의 `returned_at` 을 확인한다.
4. USB 보드를 분리하기 전에 serial monitor/server 가 종료됐는지 확인한다.
