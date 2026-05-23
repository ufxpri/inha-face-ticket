# Core Flows

발급(Issue) · 입장(Entry) · 반납(Return) — 세 가지 핵심 유스케이스. 각 플로우는 `server/src/faceticket/application/flows/` 의 단일 모듈로 구현되어 있으며, `FlowRunner` 가 세 플로우를 dispatch 한다.

상태 기계 정의는 `server/src/faceticket/domain/states.py` 의 `FlowState` 열거형 참조.

## ① 발급 (Issue)

운영자가 좌석 정보를 입력하면 태블릿 카메라로 얼굴을 캡처하고, 추출된 임베딩과 좌석을 BLE 로 팔찌에 기록한다.

```
운영자 좌석 입력  →  태블릿 캡처  →  서버 임베딩 추출  →  팔찌 NFC 태깅
                                                              ↓
                              BLE 연결  →  임베딩 + 좌석 write  →  SQLite 영구 기록
                                                              ↓
                                                  연결 해제  →  "발급 완료"
```

상세 단계 (`IssueFlow`):
1. `admin click "issue_start"` → `FlowRunner.issue_start` → `IssueFlow.start(seat, name)` → state=`AWAIT_FACE`
2. 태블릿이 WebSocket 으로 이미지 송신 → `face.extract` → state=`AWAIT_TAG`
3. `admin click "issue_tag"` → `devices.active.wake_wristband()` → BLE session 열기
4. `ble.write_embedding(emb)` + `ble.write_seat(seat)` + `repo.record_issue(wid, seat, name)` + `ble.write_led_effect(LED_ISSUED)`
5. `emit_complete` + state=`DONE` → `IDLE`

[`architecture.md`](architecture.md) 의 데이터 흐름 다이어그램 참조.

## ② 입장 (Entry) — 핵심

```
팔찌 NFC 태깅  →  BLE 연결  →  팔찌에서 임베딩 + 분리 플래그 read
                                              ↓
                  태블릿 캡처  →  현장 임베딩 추출  →  코사인 유사도 계산
                                              ↓
        (유사도 ≥ COSINE_THRESHOLD) ∧ (분리 플래그 = 0)
                                              ↓
                                   서보 OPEN + LED 녹색
                                              ↓
                  초음파 통과 감지  →  BLE 결과 LED 효과  →  연결 해제
```

거부 조건:
- 유사도 < 임곗값 → `LED_FAILURE` + `signal_deny`
- 분리 플래그 = 1 (팔찌가 한 번이라도 손목에서 빠진 적이 있음) → 유사도와 무관하게 즉시 거부
- 정면도 게이트 실패 (측면/기울임/원거리) → 임베딩 추출 *전에* 차단, 재캡처 유도

## ③ 반납 (Return)

```
팔찌 NFC 태깅  →  BLE 연결  →  임베딩 / 좌석 / 분리 플래그 0 으로 덮어쓰기
                                              ↓
                                  repo.record_return(wid)
                                              ↓
                                          연결 해제
```

팔찌 내부의 임베딩 벡터와 좌석 정보, 분리 플래그가 모두 0 으로 초기화되어 다음 발급 사이클을 위해 회수된다.

## 채널별 메시지 흐름

각 플로우의 채널별 메시지(WS · Serial · BLE · NFC) 시퀀스는 12주차 활동 보고서(`12주차 활동 보고서.html`) 의 그림 3-1 / 4-1 시퀀스 다이어그램 및 다음 문서:

- WebSocket — [`ws-protocol.md`](ws-protocol.md)
- USB Serial — [`serial-protocol.md`](serial-protocol.md)
- BLE GATT + 청크 프로토콜 — [`ble-protocol.md`](ble-protocol.md)

## 상태 기계

```
IDLE ─── issue_start ───→ AWAIT_FACE ─── face captured ───→ AWAIT_TAG ─── tag confirmed ───→ DONE
  ↑                                                                                              │
  └──────────────────────────────── DONE → IDLE ────────────────────────────────────────────────┘

(Entry / Return 도 동일한 패턴 — flows/_base.py 참조)
```

토글(BLE/Face hot-swap)은 `IDLE` 상태에서만 허용 — `ToggleService.toggle` 이 진행 중 절차를 차단.
