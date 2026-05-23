#!/usr/bin/env bash
# 개발용 서버 실행 헬퍼 — venv 자동 생성 + requirements 설치 + run.py 실행.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE/../server"

if [[ ! -d .venv ]]; then
  echo "→ creating .venv"
  python3 -m venv .venv
  # shellcheck disable=SC1091
  source .venv/bin/activate
  pip install --upgrade pip
  pip install -r requirements.txt
else
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

exec python run.py
