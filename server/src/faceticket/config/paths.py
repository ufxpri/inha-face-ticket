"""파일시스템 경로 — 패키지 구조에 종속."""
from __future__ import annotations

from pathlib import Path

APP_DIR: Path = Path(__file__).resolve().parent.parent          # src/faceticket/
SRC_DIR: Path = APP_DIR.parent                                  # src/
SERVER_DIR: Path = SRC_DIR.parent                               # server/
WEB_DIR: Path = APP_DIR / "web"
STATIC_DIR: Path = WEB_DIR / "static"
TEMPLATES_DIR: Path = WEB_DIR / "templates"
DB_PATH: Path = SERVER_DIR / "issue.db"
