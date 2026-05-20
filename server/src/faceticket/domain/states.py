"""FSM 상태와 절차 모드 — Python 측 단일 출처.

값은 모두 소문자 문자열. JS 측은 별도 상수 파일 없이 동일한 문자열 리터럴을 직접 비교한다
(예전 `states.js` 폐지). 새 상태를 추가하면 admin/tablet JSX 의 매칭 코드에도 같은 문자열을
넣으면 끝.
"""
from __future__ import annotations

from enum import Enum


class FlowState(str, Enum):
    """admin 콘솔로 송신되는 FSM 상태."""

    IDLE              = "idle"
    AWAIT_FACE        = "await_face"          # 발급 — 태블릿 캡처 대기
    AWAIT_TAG         = "await_tag"           # 발급/입장/반납 — 팔찌 태그 대기
    AWAIT_FACE_ENTRY  = "await_face_entry"    # 입장 — 태블릿 캡처 대기
    DONE              = "done"


class Flow(str, Enum):
    """절차 모드 — 핸들러 / 메시지 / 태블릿 trigger.mode 에서 공유."""

    ISSUE  = "issue"
    ENTRY  = "entry"
    RETURN = "return"
