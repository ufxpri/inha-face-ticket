# Architecture

## 계층

```
   adapters/     FastAPI · WebSocket · SQLite · pyserial · bleak · facenet-pytorch
        ▼
   application/  유스케이스 (flows) · ports (Protocol) · services
        ▼
   domain/       순수 데이터 + 규칙 (states · session · embedding · frontality · errors)
```

화살표는 import 방향. 안쪽으로만 의존한다.

| 계층 | 허용 import |
|---|---|
| `domain/`        | stdlib, numpy |
| `application/`   | `domain.*`, `application.ports.*` |
| `adapters/`      | `application.ports`, `domain.*`, 3rd-party (FastAPI / bleak / pyserial / SQLite / torch) |
| `config/`        | stdlib (선택적으로 pydantic) |
| `infra/`         | adapters + application 조립용 |

## 핵심 포트 (인터페이스)

```python
# application/ports/
class IFaceRecognizer:    extract(img_bytes) → ExtractResult(ok, embedding, reason); is_ml_active; set_force_stub(...)
class IBleCentral:        connect_wristband/disconnect/write_embedding/read_embedding/write_seat/read_contact_flag/read_wristband_id/write_led_effect/clear_wristband
class IOperatorDevice:    connect/disconnect/wake_wristband/signal_pass/signal_deny/clear_wristband + is_connected, port
class IIssueRepository:   record_issue / record_return / list_active / find_active_by_wristband / close
class IPresenter:         emit_state/emit_log/emit_complete/emit_embedding_snapshot/request_capture/emit_capture_result/emit_active_list/emit_flags
```

## 데이터 흐름 — 발급 (IssueFlow)

```
admin click ▷ "issue_start"
    → ws_admin → FlowRunner.issue_start
        → IssueFlow.start(seat, name)
            → presenter.emit_state(AWAIT_FACE)
            → presenter.request_capture(Flow.ISSUE, seat)

tablet 카메라 캡처 ▷ WS image
    → ws_tablet → face.extract → emit_capture_result + emit_embedding_snapshot
    → FlowRunner.face_captured(emb)
        → IssueFlow.on_face_captured(emb)
            → presenter.emit_state(AWAIT_TAG)

admin click ▷ "issue_tag"
    → FlowRunner.issue_tag
        → IssueFlow.on_tag
            → devices.active.wake_wristband()
            → async with ble.session():
                  ble.write_embedding(emb)
                  ble.write_seat(seat)
                  wid = ble.read_wristband_id()
                  repo.record_issue(wid, seat, name)
                  ble.write_led_effect(LED_ISSUED)
            → return IssueOutcome(ok=True, wid, seat, issue_id)
        → presenter.emit_complete + emit_state(DONE → IDLE)
```

## 컴포지션 루트 — `infra/container.py`

`build_container(settings) → Container` 한 함수에서 모든 싱글톤을 위상 정렬 순서로 생성. 테스트 / mock 주입은 이 함수에 다른 `Settings` 또는 직접 dataclass 생성으로 해결.

## 런타임 토글

- `BleSwap(IBleCentral)`: `set_mock(True/False)` 로 backend 교체. 명시적 forwarding (이전 `__getattr__` 매직 제거).
- `FacenetRecognizer.set_force_stub(True)`: 모델이 있어도 stub 으로 폴백.

토글은 진행 중 절차가 없을 때만 허용 (admin 페이지 토글 버튼이 `ToggleService.toggle` 호출).

## 프론트엔드 (`web/static/`)

Babel-standalone, 빌드 단계 없음. 모든 모듈은 `window.FT.{atoms,molecules,lib,hooks,...}` 단일 네임스페이스에 등록. 스크립트 태그 로드 순서: theme/data/lib → atoms → molecules → admin/tablet entry.

```
static/
├── theme/theme.jsx
├── data/show-fixture.js
├── lib/{scaler.jsx, srand.js}
├── atoms/      face-portrait · radial-viz · kv · status-chip · mono-line · data-bars
│               · section-heading · form-field · big-button · table · zone-badge · show-countdown
├── molecules/  hero-face · result-card · ticket-stub · show-strip · showtime-timeline
│               · stage-map · setlist-panel · capacity-gauge · admin-header
│               · device-panel · log-feed · tablet-mirror · tablet-header · tablet-footer · idle-callout
├── admin/      admin-app · admin-live · hooks
└── tablet/     tablet-app · tablet-live · hooks · footers
```

- 정적 데이터 분리: 좌석/세트리스트/관객 명단 등은 `data/` 에 모음.
- 훅: `useAdminState`, `useAdminWebSocket`, `useTabletViewState`, `useCamera`, `useCountdownAndCapture`.
- 상태/플로우 상수는 별도 파일 없이 문자열 리터럴 (`'idle'`, `'await_face'`, `'issue'` …) 을 양쪽이 직접 비교.
