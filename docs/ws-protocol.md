# WebSocket 프로토콜

서버 ↔ 브라우저 간 메시지 스키마. 모든 outbound 메시지는 `server/src/faceticket/adapters/web/ws_protocol.py` 의 빌더 함수에서 생성. 새 메시지를 추가할 땐 거기 빌더 하나 + tablet/admin JSX 의 핸들러 코드 한 곳만 수정한다.

## 엔드포인트

| URL | 역할 | hello payload |
|---|---|---|
| `/ws/admin`  | 운영자 콘솔  | `{type:"hello", role:"admin", ml, ble_mock, …, available_ports:[…]}` |
| `/ws/tablet` | 태블릿 카메라 | `{type:"hello", role:"tablet", cosine_threshold:0.55}` |

## 서버 → 브라우저 (outbound)

| type | 수신자 | payload |
|---|---|---|
| `hello`            | both       | `role`, 시스템 스냅샷 |
| `log`              | admin      | `{level: "info"|"warn"|"error", msg}` |
| `state`            | admin      | `{state: "idle"|"await_face"|"await_tag"|"await_face_entry"|"done", ...extra}` |
| `capture_trigger`  | tablet     | `{mode: "issue"|"entry", seat?}` |
| `capture_result`   | tablet     | `{ok, msg, embedding?: number[]}` |
| `embedding`        | admin      | `{embedding: number[], captured_at: "HH:MM:SS"}` |
| `complete`         | tablet     | `{ok, msg, ...extra (wristband_id, seat, similarity, passed, returned, …)}` |
| `active_list`      | admin      | `{items: IssueRecord[]}` |
| `flags`            | admin      | 시스템 스냅샷 (ml, ble_mock, …) |

상태 전이: `idle → await_face → await_tag → done → idle` (발급)  ·  `idle → await_tag → await_face_entry → done → idle` (입장)  ·  `idle → await_tag → done → idle` (반납). `done` 은 약 2초간 머무른 뒤 자동으로 `idle` 로.

## 브라우저 → 서버 (inbound)

운영자 콘솔에서 전송. `ws_protocol.parse_admin_message` 가 dataclass 로 정규화.

| type | 필드 | 의미 |
|---|---|---|
| `issue_start`      | `seat`, `name` | 발급 시작 |
| `issue_tag`        |                | 발급 — 팔찌 태그 완료 |
| `entry_start`      |                | 입장 시작 |
| `entry_tag`        |                | 입장 — 팔찌 태그 완료 |
| `return_start`     |                | 반납 시작 |
| `return_tag`       |                | 반납 — 팔찌 태그 완료 |
| `cancel`           |                | 진행 중 절차 취소 |
| `list_active`      |                | 현재 활성 발급 목록 요청 |
| `toggle`           | `layer`("face"|"ble"), `mock`(bool) | mock 토글 |
| `io_connect`       | `device`("issuance"|"entry"), `port` | 시리얼 장치 연결 |
| `io_disconnect`    | `device` | 시리얼 장치 해제 |
| `io_refresh_ports` |          | 시스템 시리얼 포트 목록 재조회 |

태블릿 → 서버:

| type | 필드 |
|---|---|
| `image` | `data` (base64 JPEG, `data:image/jpeg;base64,…` prefix 허용) |
