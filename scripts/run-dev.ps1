# 개발용 서버 실행 헬퍼 (PowerShell) — venv 자동 생성 + requirements 설치 + run.py 실행.
$ErrorActionPreference = "Stop"

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $here "..\server")

if (-not (Test-Path ".venv")) {
    Write-Host "-> creating .venv"
    python -m venv .venv
    & .\.venv\Scripts\Activate.ps1
    python -m pip install --upgrade pip
    pip install -r requirements.txt
} else {
    & .\.venv\Scripts\Activate.ps1
}

python run.py
