"""포트 — application 이 의존하는 인터페이스. 구현체는 `adapters/` 에 있다.

설계 노트 — Protocol 사용 패턴
    모든 포트는 `@runtime_checkable` 를 단 `typing.Protocol` 로 선언한다. 어댑터(구현체)는
    `class FacenetRecognizer(IFaceRecognizer):` 처럼 **명시 상속**까지 함께 한다. 이는 둘
    다 의도:
        - 구조적 매칭 (Protocol 본래의 duck typing) — 외부 라이브러리나 테스트 페이크가
          상속 없이도 만족할 수 있도록.
        - 명시 상속 — IDE 자동완성과 mypy 가 "이 클래스가 어느 포트를 구현하는지" 즉시
          알 수 있도록.
    nominal subtype 과 structural subtype 의 장점을 모두 활용하는 패턴이라 양쪽 다 둔다.
"""
from faceticket.application.ports.ble_port import IBleCentral
from faceticket.application.ports.device_port import (
    LED_COMMANDS,
    LED_PATTERNS,
    ROLE_GATE,
    ROLE_NFC,
    ROLES,
    IOperatorDevice,
)
from faceticket.application.ports.face_port import ExtractResult, IFaceRecognizer
from faceticket.application.ports.issue_repo import IIssueRepository, IssueRecord
from faceticket.application.ports.presenter import IPresenter, LogLevel

__all__ = [
    "IBleCentral",
    "IOperatorDevice", "ROLE_NFC", "ROLE_GATE", "ROLES", "LED_COMMANDS", "LED_PATTERNS",
    "ExtractResult", "IFaceRecognizer",
    "IIssueRepository", "IssueRecord",
    "IPresenter", "LogLevel",
]
