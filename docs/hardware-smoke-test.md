# Hardware Smoke Test

실기기 업로드 직후 서버 전체 플로우를 돌리기 전에, 펌웨어와 호스트 사이의 최소 통신 계약만 확인하는 절차다.

## 준비

- 서버 가상환경에 `pyserial`, `bleak` 이 설치돼 있어야 한다. `scripts/run-dev.sh` 를 한 번 실행했거나 `server/requirements.txt` 를 설치했다면 준비된 상태다.
- 아래 명령은 repo root 에서 `server/.venv/bin/python` 으로 실행하는 기준이다. 가상환경을 이미 활성화했다면 `python` 으로 바꿔도 된다.
- `pio device monitor`, Arduino IDE Serial Monitor, 서버 프로세스가 같은 serial 포트를 점유하고 있으면 먼저 종료한다.
- `PASS` 는 서보를 움직이고 초음파 통과 감지를 기다린다. 게이트 주변을 비운 뒤 실행한다.
- 현재 Arduino UNO 스케치는 PN5180 `WAKE`/`CLEAR` 가 미구현이다. 따라서 Arduino serial smoke test 에서 두 명령은 `ERR NFC_*_NOT_IMPLEMENTED` 가 정상 기대값이다.

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

## Arduino UNO 빌드/업로드

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
  --port /dev/cu.usbmodemXXXX
```

기대 결과:

- `PING` -> `OK PONG`
- `DENY` -> `OK`
- `WAKE` -> `ERR NFC_WAKE_NOT_IMPLEMENTED`
- `CLEAR` -> `ERR NFC_CLEAR_NOT_IMPLEMENTED`

게이트 통과 감지까지 확인하려면 `PASS` 를 명시적으로 포함한다.

```bash
server/.venv/bin/python scripts/hardware-smoke-test.py serial \
  --target arduino \
  --port /dev/cu.usbmodemXXXX \
  --include-pass
```

`PASS` 성공 기대값은 `OK passed` 다. 사람이 지나가지 않거나 초음파 감지가 실패하면 `OK timeout` 이 나오며, 서버와 smoke test 모두 실패로 처리한다.
Arduino 스케치의 통과 감지 대기 시간이 5초이므로 서버와 smoke test 는 `PASS` 명령에 한해 기본 7초까지 응답을 기다린다. smoke test 값은 `--pass-timeout` 으로 조정한다.

ESP32-C3 USB-CDC 직결 명령도 같은 스크립트로 확인할 수 있다.

```bash
server/.venv/bin/python scripts/hardware-smoke-test.py serial \
  --target esp32 \
  --port /dev/cu.usbmodemXXXX \
  --commands PING DENY WAKE CLEAR
```

ESP32-C3 직결 모드에서는 `WAKE`/`CLEAR` 가 noop 이므로 `OK` 가 정상 기대값이다.

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
- BLE scan 이 실패하면 ESP32-C3가 업로드 후 재부팅됐는지, serial monitor 가 BLE 동작을 방해하지 않는지, macOS Bluetooth 권한이 허용됐는지 확인한다.
- `verify-embedding@...` 이 실패하면 BLE chunk write/read 계약이 깨진 것이다. `docs/ble-protocol.md` 와 `firmware/wristband/src/main.cpp` 의 UUID/chunk 크기를 같이 확인한다.
