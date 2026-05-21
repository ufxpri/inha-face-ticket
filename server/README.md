# server — FastAPI 노트북 서버

도메인 / 유스케이스 / 어댑터 3계층으로 재구성된 `faceticket` 패키지.

## 실행

```bash
cd server
python -m venv .venv && source .venv/bin/activate
pip install -e .              # pyproject.toml 사용
# 또는 ML 모델까지:
pip install -e ".[ml,dev]"

faceticket --host 0.0.0.0 --port 8000
# 또는
python -m faceticket
```

환경변수: `FT_HOST`, `FT_PORT`, `FT_ISSUANCE_PORT`, `FT_ENTRY_PORT`, `FT_BLE_MOCK`, `FT_FACE_STUB`.

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
├── infra/                 logging · container (composition root)
├── cli.py                 uvicorn 진입점
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
| `main.py` 602줄            | `cli.py` + `adapters/web/{app_factory,ws_admin,ws_tablet,http_routes,lifespan}` |
| `FlowController` god-class | `application/flows/{issuance,entry,return_}.py` + `flow_runner.py` |
| WS dict 리터럴 산재         | `adapters/web/ws_protocol.py` 한 곳에서 빌더 |
| `BLEClient.__getattr__` 마법| `BleSwap(IBleCentral)` 명시적 forwarding |
| `IssuanceDevice`/`EntryDevice` 80% 복붙 | `SerialTransport` 공유 + 1줄짜리 프로토콜 매핑 |
| `print()` 곳곳              | `logging.getLogger(__name__)` + console/WS sink |
| `config.py` 한 파일 grab-bag | `config/{paths,ble_uuids,face_thresholds,led_codes,settings}.py` |
| `states.py` + `states.js` 수동 미러 | `FlowState`/`Flow` enum + JS 측은 문자열 리터럴 직접 비교 |
