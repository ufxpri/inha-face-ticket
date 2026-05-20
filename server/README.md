# server — FastAPI 노트북 서버

`app.main:app` 를 uvicorn 으로 띄우는 FastAPI 애플리케이션. 발급/입장/반납 절차의 비즈니스 로직 (`FlowController`), WebSocket 브로드캐스트 (`ClientPool`), 운영자 장치 레지스트리 (`DeviceRegistry`) 를 담는다.

## 실행

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m app.main
```

import 경로는 모두 `app.*` 네임스페이스를 사용한다. `server/` 디렉터리에서 실행해야 한다.

## 모듈

| 파일 | 역할 |
|---|---|
| `app/main.py`           | FastAPI 라우트 + WS 핸들러 + 흐름 컨트롤러 |
| `app/config.py`         | 경로 / UUID / 임곗값 / mock 플래그 |
| `app/states.py`         | State, Flow 열거형 (브라우저 `states.js` 미러) |
| `app/db.py`             | SQLite 발급 세션 |
| `app/face.py`           | facenet-pytorch 임베딩 + 코사인 유사도 |
| `app/ble_client.py`     | BLE Central (bleak / mock) |
| `app/devices/registry.py`  | DeviceRegistry — 발급/입장 장치 mutex |
| `app/devices/issuance.py`  | NFC 라이터 + 게이트 아두이노 |
| `app/devices/entry.py`     | ESP32-C3 팔찌 USB-CDC 직결 |

## 정적 자산

- `app/web/static/*.jsx` — Babel-standalone 으로 브라우저에서 변환
- `app/web/templates/{admin,tablet}.html` — 진입 HTML
