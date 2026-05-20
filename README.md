# inha-face-ticket

오프라인 얼굴인증 전자 티켓 시스템 — 인하대학교 IoT프로그래밍(ITC3211) 기말 과제.

발급장치(NFC + 게이트 아두이노) / 입장장치(ESP32-C3 팔찌 USB-CDC) / 노트북 FastAPI 서버 / 태블릿 카메라 / BLE 팔찌 펌웨어로 구성된 멀티-디바이스 시스템.

## 리포지토리 레이아웃

```
.
├── server/                  FastAPI 서버 (Python)
│   ├── app/
│   │   ├── main.py          진입점 (uvicorn app.main:app)
│   │   ├── config.py        UUID / 임곗값 / 경로
│   │   ├── face.py          얼굴 임베딩 (facenet-pytorch / 폴백 stub)
│   │   ├── ble_client.py    BLE Central (bleak / mock)
│   │   ├── db.py            SQLite 발급 세션
│   │   ├── states.py        State / Flow 열거형
│   │   ├── devices/         발급장치 · 입장장치 · 레지스트리
│   │   └── web/
│   │       ├── static/      JSX, JS (Babel-standalone 으로 브라우저 변환)
│   │       └── templates/   admin.html, tablet.html
│   └── requirements.txt
├── firmware/
│   ├── wristband/           ESP32-C3 팔찌 (PlatformIO)
│   ├── arduino-gate/        Arduino UNO NFC + 게이트
│   └── tools/
│       └── i2c-scanner/     디버그 도구
├── docs/                    아키텍처 / 프로토콜 문서
├── hardware/                회로도, 핀맵
└── scripts/                 개발 헬퍼
```

## 빠른 시작 (서버)

```bash
cd server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m app.main         # 또는 uvicorn app.main:app --host 0.0.0.0 --port 8000
```

- 운영자 페이지: <http://localhost:8000/admin>
- 태블릿 페이지: <http://<노트북IP>:8000/tablet> (카메라 권한 필요 — `localhost` 또는 HTTPS)

## 펌웨어 빌드

```bash
cd firmware/wristband
pio run -t upload && pio device monitor
```

`firmware/arduino-gate/arduino_uno.ino` 는 Arduino IDE 또는 `arduino-cli` 로 업로드.

## 동작 모드

`server/app/config.py` 의 `BLE_MOCK`, `AUTO_CONNECT_*_PORT` 와 의존성 설치 여부에 따라 각 레이어가 자동으로 실제/mock 으로 전환된다. 자세한 흐름과 BLE GATT/시리얼 프로토콜은 `docs/` 참고.
