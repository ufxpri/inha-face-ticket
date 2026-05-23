# server — FastAPI 노트북 서버

도메인 / 유스케이스 / 어댑터 3계층으로 재구성된 `faceticket` 패키지.

## 실행

### 사전 요구사항

- **Python 3.11+** (`python --version` 으로 확인)
- (선택) **CPython 호환 GPU/CPU** — 실제 얼굴 임베딩(`facenet-pytorch`) 사용 시. 미설치여도 stub 모드로 자동 폴백 → 데모/개발은 무설치 가능.
- (선택) **시리얼 포트** — 통합 운영자 장치(Arduino UNO 또는 ESP32-C3 USB-CDC) 연결 시. 없으면 운영자 UI 에서 `SIM` 가상 포트 선택.

### 1. 가상환경 + 의존성

```bash
cd server
python -m venv .venv

# Linux / macOS
source .venv/bin/activate

# Windows (PowerShell)
.\.venv\Scripts\Activate.ps1

pip install --upgrade pip
pip install -r requirements.txt
# requirements.txt 는 런타임 7개 + torch/torchvision/facenet-pytorch(~2GB) 까지 한 번에 설치.
# 모델 다운로드 / CUDA 가 부담이라면 ML 3줄을 주석 처리하고 설치 — 얼굴 인식은 자동으로 stub 폴백.
```

### 2. 실행

```bash
python run.py
```

`run.py` 는 `src/` 를 `sys.path` 에 얹어 **패키지 설치 없이** 바로 부팅한다 (`pip install -e .` 불필요). 모든 옵션은 환경변수로만 지정 — CLI 인자 파서 없음.

원-라이너 헬퍼 (venv 가 없으면 자동 생성 + 설치):

```bash
# Linux / macOS
./scripts/run-dev.sh

# Windows (PowerShell)
.\scripts\run-dev.ps1
```

종료는 `Ctrl+C` (uvicorn graceful shutdown).

### 3. 접속

| 페이지 | URL | 비고 |
|---|---|---|
| 운영자 | `https://localhost:8000/admin` | 같은 노트북에서 |
| 태블릿 | `https://<노트북IP>:8000/tablet` | LAN 의 태블릿 브라우저에서. **HTTPS 필수** (카메라 `getUserMedia` 가 secure context 만 허용) |

`<노트북IP>` 는 `ipconfig` (Windows) / `ifconfig` 또는 `ip addr` (Unix) 로 확인. 서버 부팅 로그의 `SAN=[...]` 줄에 자동으로 감지된 IP 들이 함께 출력된다.

### 4. HTTPS / 자체 서명 인증서

- 기본 HTTPS 활성. 최초 부팅 시 `server/certs/server.{crt,key}` 가 자동 생성된다.
- 인증서 SAN(Subject Alternative Name) 에는 `localhost`, `127.0.0.1`, 그리고 부팅 당시 호스트의 모든 LAN IPv4 가 포함 → 태블릿이 `https://192.168.x.y:8000` 형태로 직접 접속해도 호스트 미스매치 경고 없음 (단, "이 인증서는 신뢰되지 않음" 경고는 1회 수락 필요).
- 노트북 IP 가 바뀌었다면 `server/certs/` 를 삭제하고 재부팅 → 새 SAN 으로 재발급.
- 회사/학교에서 받은 정식 인증서를 쓰려면 `FT_SSL_CERT=/path/to/full.crt FT_SSL_KEY=/path/to/key.pem python run.py`.
- 평문 HTTP 로 띄우려면 `FT_SSL=0 python run.py` (단, 태블릿 카메라는 동작 안 함 — `localhost` 접속에서만 가능).

### 5. 환경변수

| 변수 | 기본 | 설명 |
|---|---|---|
| `FT_HOST` | `0.0.0.0` | uvicorn bind 호스트 |
| `FT_PORT` | `8000` | uvicorn bind 포트 |
| `FT_SSL` | `1` | `0`/`false` 로 두면 평문 HTTP |
| `FT_SSL_CERT` | (자동) | PEM 인증서 경로 — 미지정 시 `server/certs/server.crt` 사용/생성 |
| `FT_SSL_KEY` | (자동) | PEM 비밀키 경로 — 미지정 시 `server/certs/server.key` 사용/생성 |
| `FT_OPERATOR_PORT` | (없음) | 운영자 장치 시리얼 포트 (예: `COM5` / `/dev/ttyACM0` / `SIM`). 미지정 시 부팅 직후 자동연결 생략 — 운영자 UI 에서 수동 선택 |
| `FT_SERIAL_BAUD` | `115200` | 운영자 장치 시리얼 보드레이트 |
| `FT_BLE_MOCK` | `1` | `0` 으로 두면 실제 bleak BLE central 사용. 기본은 mock 팔찌 (BLE 동글 없이도 동작) |
| `FT_FACE_STUB` | `0` | `1` 이면 `facenet-pytorch` 가 설치돼 있어도 stub 임베딩 강제 — 모델 로딩 시간 회피 / 결정적 테스트용 |

> bool 값은 `1`/`true`/`yes`/`on` 만 참으로 인식 (대소문자 무관). 그 외는 거짓.

예시:

```bash
# 평문 HTTP, 운영자 장치 SIM 모드, BLE 도 mock
FT_SSL=0 FT_OPERATOR_PORT=SIM FT_BLE_MOCK=1 python run.py

# 4443 포트, 실제 bleak BLE, 실제 시리얼 (COM5)
FT_PORT=4443 FT_BLE_MOCK=0 FT_OPERATOR_PORT=COM5 python run.py
```

PowerShell 에서는 `$env:FT_PORT=4443; python run.py`.

### 6. 동작 확인

부팅 로그가 다음 비슷하면 정상:

```
INFO  faceticket.adapters.face.facenet — facenet-pytorch 사용 불가(...) — stub 모드
INFO  faceticket.adapters.ble.swap — backend = MOCK
INFO  faceticket.infra.tls — self-signed TLS cert generated: .../server/certs/server.crt (SAN=['localhost', '192.168.x.y', '127.0.0.1', ...])
INFO  faceticket.adapters.web.lifespan — 서버 기동
INFO:     Uvicorn running on https://0.0.0.0:8000 (Press CTRL+C to quit)
```

각 어댑터의 현재 모드(`stub`/`facenet`, `mock`/`bleak`, `SIM`/실포트)는 운영자 페이지 상단 배지에서도 확인 가능.

### 7. 자주 마주치는 문제

- **태블릿에서 카메라가 안 켜진다** → URL 이 `http://` 인지 확인. `https://` + 자체서명 경고 수락이 필수.
- **`ModuleNotFoundError: No module named 'uvicorn'`** → venv 활성화 안 됨. `which python` / `where python` 으로 `.venv` 경로 확인.
- **`Address already in use`** → 다른 프로세스가 8000 점유. `FT_PORT=8001 python run.py` 로 우회.
- **인증서 경고가 매번 뜬다** → 브라우저 정책. Chrome 의 경우 주소창에 `thisisunsafe` 입력으로 영구 신뢰 처리 가능 (학습/개발용).
- **운영자 장치가 안 잡힌다** → `FT_OPERATOR_PORT` 환경변수보다는 운영자 UI 의 포트 드롭다운에서 수동 선택을 권장 — 어떤 포트가 잡히는지 한눈에 보임.

## 패키지 구조

```
src/faceticket/
├── domain/                pure: states / session / embedding / frontality / errors
├── application/
│   ├── ports/             IFaceRecognizer · IBleCentral · IOperatorDevice · IIssueRepository · IPresenter
│   ├── flows/             IssueFlow · EntryFlow · ReturnFlow
│   ├── flow_runner.py     세 플로우 dispatch + 세션 소유
│   ├── device_service.py
│   └── toggle_service.py
├── adapters/
│   ├── face/              FacenetRecognizer · HashStubRecognizer · factory
│   ├── ble/               BleakBleCentral · MockBleCentral · BleSwap (명시적 hot-swap)
│   ├── devices/           SerialTransport · OperatorDevice · list_serial_ports
│   ├── persistence/       SqliteIssueRepository
│   └── web/               app_factory · lifespan · http_routes · ws_admin · ws_tablet · ws_protocol · presenter · client_pool
├── config/                paths · ble_uuids · face_thresholds · led_codes · settings
├── infra/                 logging · container · tls (composition root)
└── web/                   static (JSX) + templates (HTML)
```

## 아키텍처 원칙

| 계층 | import 가능 |
|---|---|
| `domain/`        | stdlib, numpy |
| `application/`   | domain.*, application.ports.* |
| `adapters/`      | application.ports, domain.*, 3rd-party (FastAPI / bleak / pyserial / SQLite) |
| `config/`        | stdlib |
| `infra/`         | adapters + application 조립용 |

도메인이 wire format(WS dict) 을 만들지 않는다. flows / services 는 `IPresenter` 만 호출,
`WebSocketPresenter` 어댑터에서 한 곳에서만 직렬화. 모든 메시지 빌더는 `adapters/web/ws_protocol.py`.

## 테스트

```bash
pytest                       # 도메인 + 어댑터 단위 테스트
```

## 구 구조와 차이

| 구 (`app/`)                | 신 (`src/faceticket/`)                              |
|---|---|
| `main.py` 602줄            | `run.py` + `adapters/web/{app_factory,ws_admin,ws_tablet,http_routes,lifespan}` |
| `FlowController` god-class | `application/flows/{issuance,entry,return_}.py` + `flow_runner.py` |
| WS dict 리터럴 산재         | `adapters/web/ws_protocol.py` 한 곳에서 빌더 |
| `BLEClient.__getattr__` 마법| `BleSwap(IBleCentral)` 명시적 forwarding |
| `IssuanceDevice`/`EntryDevice` 80% 복붙 | `SerialTransport` 공유 + 1줄짜리 프로토콜 매핑 |
| `print()` 곳곳              | `logging.getLogger(__name__)` + console/WS sink |
| `config.py` 한 파일 grab-bag | `config/{paths,ble_uuids,face_thresholds,led_codes,settings}.py` |
| `states.py` + `states.js` 수동 미러 | `FlowState`/`Flow` enum + JS 측은 문자열 리터럴 직접 비교 |
