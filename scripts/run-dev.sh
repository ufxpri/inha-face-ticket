#!/usr/bin/env bash
# 개발용 서버 실행 헬퍼.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE/../server"

if [[ ! -d .venv ]]; then
  echo "→ creating .venv"
  python3 -m venv .venv
  source .venv/bin/activate
  pip install --upgrade pip
  pip install -r requirements.txt
else
  source .venv/bin/activate
fi

exec python -m app.main
