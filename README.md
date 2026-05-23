# inha-face-ticket

오프라인 얼굴인증 전자 티켓 시스템 — 인하대학교 IoT프로그래밍(ITC3211) 기말 과제.

통합 운영자 장치(Arduino UNO + NFC writer + 게이트 서보 / 또는 ESP32-C3 팔찌 USB-CDC 직결, 둘 다 동일 프로토콜) / 노트북 FastAPI 서버 / 태블릿 카메라 / ESP32-C3 BLE 팔찌 펌웨어로 구성된 멀티-디바이스 시스템.

## 리포지토리 레이아웃

```
.
├── server/                          FastAPI 서버 (Python 3.11+)
│   ├── pyproject.toml               패키지 메타 + extras (ml, dev)
│   ├── requirements.txt             (구버전 호환용)
│   ├── README.md                    백엔드 상세
│   ├── src/faceticket/              패키지 루트
│   │   ├── domain/                  순수 타입/규칙 (states / session / embedding / frontality / errors)
│   │   ├── application/             유스케이스 (flows: issue/entry/return) + 포트(Protocol)
│   │   │   ├── ports/               IFaceRecognizer · IBleCentral · IOperatorDevice · IIssueRepository · IPresenter
│   │   │   ├── flows/
│   │   │   ├── flow_runner.py
│   │   │   ├── device_service.py
│   │   │   └── toggle_service.py
│   │   ├── adapters/                I/O 구현 (FastAPI, bleak, pyserial, SQLite, facenet-pytorch)
│   │   │   ├── face/                FacenetRecognizer · HashStubRecognizer
│   │   │   ├── ble/                 BleakBleCentral · MockBleCentral · BleSwap (명시적 hot-swap)
│   │   │   ├── devices/             SerialTransport · OperatorDevice (단일 통합 장치)
│   │   │   ├── persistence/         SqliteIssueRepository
│   │   │   └── web/                 app_factory · lifespan · ws_protocol · ws_admin · ws_tablet · presenter
│   │   ├── config/                  paths · ble_uuids · face_thresholds · led_codes · settings
│   │   ├── infra/                   logging · container (composition root)
│   │   ├── cli.py                   uvicorn 진입 (python -m faceticket)
│   │   └── web/                     static (JSX, window.FT 네임스페이스) + templates
│   └── tests/
├── firmware/
│   ├── wristband/                   ESP32-C3 팔찌 (PlatformIO)
│   ├── arduino-gate/                Arduino UNO NFC + 게이트
│   └── tools/i2c-scanner/           디버그 도구
├── docs/
│   ├── architecture.md              계층/의존성 규칙
│   ├── ble-protocol.md              GATT 정의 + 청크 프로토콜
│   ├── serial-protocol.md           시리얼 명령/응답
│   └── ws-protocol.md               WebSocket 메시지 스키마
├── hardware/
└── scripts/
```

## 빠른 시작 (서버)

```bash
cd server
python -m venv .venv && source .venv/bin/activate    # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt                       # 실제 얼굴 모델까지 한 번에
python run.py                                         # 설정은 아래 환경변수만 사용
```

> 헬퍼: `scripts/run-dev.sh` (bash) 또는 `scripts/run-dev.ps1` (PowerShell) 가 venv 생성 + 의존성 설치 + 실행을 한 번에 처리.

- 운영자 페이지: <https://localhost:8000/admin>
- 태블릿 페이지: <https://<노트북IP>:8000/tablet> (카메라 권한 필요 — `localhost` 또는 HTTPS)

> HTTPS 는 기본 활성. 최초 실행 시 `server/certs/server.{crt,key}` 가 호스트의 모든 LAN IP 를
> SAN 에 포함한 자체 서명 인증서로 자동 생성된다. 태블릿에서 처음 접속할 때 "안전하지 않음"
> 경고를 한 번 수락하면 된다. 평문 HTTP 로 띄우려면 `--no-ssl` 또는 `FT_SSL=0`.

설정은 환경변수: `FT_HOST`, `FT_PORT`, `FT_BLE_MOCK`, `FT_FACE_STUB`, `FT_OPERATOR_PORT`,
`FT_SERIAL_BAUD`, `FT_SSL` (기본 1), `FT_SSL_CERT`, `FT_SSL_KEY`.

## 펌웨어 빌드

```bash
cd firmware/wristband && pio run -t upload && pio device monitor
```

`firmware/arduino-gate/arduino_uno.ino` 는 Arduino IDE 또는 `arduino-cli` 로 업로드.

## 동작 모드

| 레이어 | 의존성 | mock 동작 |
|---|---|---|
| 얼굴 (`adapters/face`) | `facenet-pytorch` (선택) | 이미지 SHA-256 시드 결정적 임베딩 |
| BLE (`adapters/ble`) | `bleak` (선택) | 메모리상 가짜 팔찌 상태 |
| 시리얼 (`adapters/devices`) | `pyserial` + 실제 포트 | `SIM` 포트 명시 시 명령별 모의 응답 |

각 레이어는 의존성이 없거나 mock 강제 설정 시 자동으로 mock 으로 폴백. 운영자 페이지 상단 배지에서 현재 모드 확인 가능.

## 아키텍처 (한 줄)

도메인(`domain/`)은 numpy 외에 import 없음 → 유스케이스(`application/`)는 포트만 의존 → 어댑터(`adapters/`)가 포트를 구현하며 FastAPI / BLE / 시리얼 / SQLite 와 통신. 상세는 [`docs/architecture.md`](docs/architecture.md).

## 라이선스

MIT (예정).
