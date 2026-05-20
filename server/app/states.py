"""FSM 상태와 절차 모드 — Python 측 단일 출처.

서버가 admin 으로 보내는 `state` 메시지의 값들, 그리고 절차 모드 식별자는
모두 여기서 정의된 문자열을 사용한다. `static/states.js` 가 동일한 값을
window.STATE / window.FLOW 로 노출하여 JS 측이 import 없이 참조한다.

값을 바꿀 일이 생기면 양쪽 파일을 함께 수정한다 — 이 파일이 문서이자 소스.
"""


class State:
    """admin → 운영자 콘솔로 송신되는 FSM 상태."""
    IDLE              = "idle"
    AWAIT_FACE        = "await_face"          # 발급 — 태블릿 캡처 대기
    AWAIT_TAG         = "await_tag"           # 발급/입장/반납 — 팔찌 태그 대기
    AWAIT_FACE_ENTRY  = "await_face_entry"    # 입장 — 태블릿 캡처 대기
    DONE              = "done"


class Flow:
    """절차 모드 — 서버 핸들러 / 메시지 / 태블릿 trigger.mode 에서 공유."""
    ISSUE  = "issue"
    ENTRY  = "entry"
    RETURN = "return"
