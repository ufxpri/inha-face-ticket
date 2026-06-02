"""런타임 설정 — 환경변수 또는 기본값.

기존 `config.py` 의 모듈-수준 전역들을 dataclass 하나로 모았다. 테스트에서 다른 값으로 주입 가능.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional


def _env_str(key: str, default: Optional[str] = None) -> Optional[str]:
    v = os.environ.get(key)
    if v is None or v.strip() == "":
        return default
    return v.strip()


def _env_bool(key: str, default: bool) -> bool:
    v = os.environ.get(key)
    if v is None:
        return default
    return v.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(key: str, default: int) -> int:
    v = os.environ.get(key)
    if v is None:
        return default
    try:
        return int(v)
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    """프로세스 시작 시 한 번 로드되는 불변 설정."""

    host: str = "0.0.0.0"
    port: int = 8000

    # 시리얼 — 부팅 시 자동연결 (None 이면 admin UI 에서 수동)
    # operator_port: 통합/SIM 폴백 (두 역할을 같은 포트로). nfc/gate: 역할별 분리 연결.
    auto_connect_operator_port: Optional[str] = None
    auto_connect_nfc_port: Optional[str] = None
    auto_connect_gate_port: Optional[str] = None
    serial_baud: int = 115200

    # BLE — True 면 bleak 가 설치돼 있어도 mock 으로 강제
    ble_mock: bool = True

    # 얼굴 — True 면 ML 모델이 있어도 stub 임베딩
    face_force_stub: bool = False

    # TLS — 태블릿이 LAN IP 로 카메라(getUserMedia) 를 쓰려면 HTTPS 가 필요.
    # ssl_enabled=True 면 cert/key 가 없을 때 자체 서명 인증서를 자동 생성.
    ssl_enabled: bool = True
    ssl_cert: Optional[str] = None
    ssl_key: Optional[str] = None

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            host=_env_str("FT_HOST", "0.0.0.0") or "0.0.0.0",
            port=_env_int("FT_PORT", 8000),
            auto_connect_operator_port=_env_str("FT_OPERATOR_PORT"),
            auto_connect_nfc_port=_env_str("FT_NFC_PORT"),
            auto_connect_gate_port=_env_str("FT_GATE_PORT"),
            serial_baud=_env_int("FT_SERIAL_BAUD", 115200),
            ble_mock=_env_bool("FT_BLE_MOCK", True),
            face_force_stub=_env_bool("FT_FACE_STUB", False),
            ssl_enabled=_env_bool("FT_SSL", True),
            ssl_cert=_env_str("FT_SSL_CERT"),
            ssl_key=_env_str("FT_SSL_KEY"),
        )


def load_settings() -> Settings:
    """프로세스에서 한 번 호출 — Container 가 들고 다닌다."""
    return Settings.from_env()
