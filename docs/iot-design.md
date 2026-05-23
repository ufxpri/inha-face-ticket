# IoT 시스템 설계 포인트

웨어러블·BLE·NFC·시리얼·카메라가 얽힌 다중 디바이스 시스템에서 IoT 강의 주제에 해당하는 핵심 결정들.

## ① 엣지 인증 — 클라우드 없는 본인 확인

얼굴 임베딩 벡터(512-d, 2KB)를 ESP32-C3 의 NVS(non-volatile storage)에 직접 저장한다. 입장 게이트는 팔찌의 BLE GATT characteristic 에서 벡터를 read 한 뒤 현장에서 새로 추출한 벡터와 **코사인 유사도** 만으로 본인을 판정 — 외부 서버·네트워크 의존성 0. 행사장 와이파이 장애에도 입장이 멈추지 않는다.

코사인 유사도 임곗값(`COSINE_THRESHOLD`) 및 정면도 게이트 임곗값은 `server/src/faceticket/config/face_thresholds.py` 에 정의. 팀원 다인 다회 캡처 데이터로 캘리브레이션 예정(W14).

## ② 전력 관리 — 평시 deep sleep + 외부 인터럽트 wake-up

3.7V/500mAh LiPo 단일 셀로 공연(2~3시간) + 대기 시간을 모두 커버해야 한다. 핵심 트릭은 **NFC 태그가 MCU 를 깨우는** 구조:

- ST25DV16K 의 `GPO_CTRL_Dyn.RF_WRITE_EN` 비트를 켜면, 외부 PN5180 리더가 EEPROM 에 쓰기를 완료할 때 GPO 핀에 펄스가 발생한다 (open-drain, 외부 풀업)
- 이 펄스를 ESP32-C3 의 GPIO 인터럽트로 받아 deep sleep wake-up trigger 로 활용
- 평시 대기 ≈ 수십 µA · BLE 활성 시 80~120mA — 운영 시간 대부분이 sleep 이므로 배터리가 버틴다

```
[정상]   sleep ─── NFC 태깅 ── GPO 펄스 ── wake-up ── BLE 광고 ── 통신 종료 ── sleep
                                                                  └─ 자동 복귀
```

대안으로 BLE 광고를 평시 송출하는 방식도 검토했으나, 30 mA 수준 평균 전류가 500 mAh 배터리에서 약 16시간만 버티는 문제로 기각.

## ③ 멀티 프로토콜 코디네이션

서로 다른 7개 통신 채널이 한 절차 안에서 직렬로 흐른다 — 단일 실패점이 절차 전체를 막지 않도록 각 어댑터에 타임아웃·재시도·상태 복원을 분산.

| 채널 | 구간 | 역할 | 상세 문서 |
|---|---|---|---|
| **WebSocket** | 태블릿 ↔ 노트북 | 카메라 트리거, 이미지 바이너리, 상태 표시 | [`ws-protocol.md`](ws-protocol.md) |
| **HTTP / HTTPS** | 운영자 브라우저 ↔ 노트북 | 운영자 페이지 + 발급 기록 조회 | [`ws-protocol.md`](ws-protocol.md) |
| **USB Serial** | 노트북 ↔ Arduino | NFC write/read, 게이트 OPEN/DENY, 통과 감지 | [`serial-protocol.md`](serial-protocol.md) |
| **SPI** | Arduino ↔ PN5180 | ISO 15693 트랜잭션 | [`serial-protocol.md`](serial-protocol.md) |
| **NFC (RF)** | PN5180 ↔ ST25DV16K | BLE 연결 정보 기록, GPO 펄스 유발 | [`ble-protocol.md`](ble-protocol.md) |
| **BLE GATT** | 노트북 ↔ ESP32-C3 | 임베딩·좌석·플래그·LED 효과 read/write | [`ble-protocol.md`](ble-protocol.md) |
| **BLE Broadcast** | 큐 송출 노트북 → 다수 팔찌 | 공연 중 동기 LED 큐 (비연결, 일대다) | [`ble-protocol.md`](ble-protocol.md) |

## ④ I²C 버스 공유 — 추가 GPIO 없는 페리페럴 확장

ESP32-C3 의 GPIO 13개는 BLE/OLED/스위치/RGB LED 까지 쓰고 나면 빠듯하다. OLED(0x3C)·ST25DV16K(0x2D/0x53/0x57) 가 모두 I²C 이고 주소가 겹치지 않는다는 점을 활용해 **단일 I²C 버스에 병렬 합류** → NFC 모듈 통합으로 추가 핀 0개. ST25DV16K 가 1MHz I²C 를 지원해 OLED 와 함께 운용해도 병목 없음.

예상 GPIO 점유:
- OLED I²C (GPIO5/6) — 점유
- ST25DV16K — 같은 I²C 버스에 합류, 추가 핀 불필요
- ST25DV16K GPO 인터럽트 — 1핀 (예: GPIO3, wake-up)
- 컨택트 스위치 — 1핀 (예: GPIO4)
- RGB LED — 3핀 (R/G/B PWM, 예: GPIO7/10/1)

## ⑤ 로직 레벨 / 전기적 호환성 검토

5V Arduino UNO ↔ 3.3V PN5180 ↔ 13.56MHz RF ↔ 3.3V ESP32-C3 ↔ 1.8~5.5V ST25DV16K 가 모두 한 회로에서 동작해야 한다.

- **로직 레벨** — PN5180 모듈의 `PVDD = 3V3` 솔더 점퍼로 5V 로직을 3.3V 로 정합. ST25DV16K 모듈은 SDA/SCL 내장 10kΩ 풀업으로 레벨 시프터 불필요
- **RF/로직 전원 분리** — PN5180 `VDD = 5V` (RF/안테나 구동), `PVDD = 3.3V` (디지털 로직) 분리로 안테나 전류 확보
- **전원 경로** — USB-C 5V → TP4056 → DTP652533 LiPo + ESP32-C3 보드 5V 핀(온보드 AMS1117 LDO 입력) 병렬. USB 미연결 시 배터리로 LDO 구동
- **NFC 프로토콜** — ST25DV16K(NFC Type 5 / ISO 15693) 와 PN5180(ISO 14443A/B · 15693 · FeliCa) 완전 호환

자세한 부품 호환성 매트릭스는 [`hardware.md`](hardware.md).

## ⑥ 위변조 방어 — 컨택트 스위치 + GATT 플래그

팔찌가 손목에서 한 번이라도 분리되면 컨택트 스위치 인터럽트가 ESP32-C3 의 휘발성/비휘발성 플래그를 set 한다. 입장 시 게이트가 임베딩과 함께 이 `CHR_FLAG` 를 read → flag=1 이면 유사도와 무관하게 거부. **카드 양도형 위변조가 물리적으로 차단**된다.

플래그 라이프사이클:
- **발급 시점** — 0 으로 초기화
- **체결 후 분리** — 1 로 set (one-way, 반납 전까지 유지)
- **입장 시점** — read 후 1 이면 LED_FAILURE + signal_deny
- **반납 시점** — 임베딩/좌석과 함께 0 으로 재초기화

## ⑦ 호스트 OS 무관 BLE 토폴로지

macOS 는 보안 정책상 BLE Central(스캐너)만 외부 장치를 선택 가능하다. 주변 장치(팔찌)가 먼저 연결을 요청하는 방식은 제한됨. 따라서 **노트북 = Central / 팔찌 = Peripheral** 로 일원화 — Windows·macOS 어느 쪽에서도 동일하게 동작.

NFC 태깅이 BLE 활성 트리거 역할을 함으로써 "팔찌가 광고 → 노트북이 발견" 의 검색 단계가 짧아져 연결 시간이 일정해진다.

## ⑧ BLE 단일 attribute 512B 한계 우회

`EMBED_DIM × 4 byte = 2048 B` 가 BLE characteristic 한 번에 들어가지 않는다. 앱 레벨에서 `EMBED_CHUNK = 256 B` 청크 분할 + `CHR_EMB_OFF` 오프셋 characteristic 으로 직전 write 의 오프셋을 펌웨어에 알려주는 *side-channel* 프로토콜:

```
write_loop:  off=0,256,…,1792 → write(CHR_EMB_OFF, off) + write(CHR_EMBEDDING, chunk)
read_loop:   off=0,256,…,1792 → write(CHR_EMB_OFF, off) + read(CHR_EMBEDDING)
```

전체 프로토콜은 [`ble-protocol.md`](ble-protocol.md).

## ⑨ 펌웨어 없이도 풀스택 검증 — 자동 mock 폴백

`bleak`/`facenet-pytorch`/실 시리얼 포트가 미설치·미연결이면 어댑터가 자동으로 mock 백엔드로 폴백:

| 레이어 | 의존성 | mock 동작 |
|---|---|---|
| 얼굴 (`adapters/face`) | `facenet-pytorch` (선택) | 이미지 SHA-256 시드 결정적 임베딩 |
| BLE (`adapters/ble`) | `bleak` (선택) | 메모리상 가짜 팔찌 상태 (read/write/flag/clear 모두 시뮬레이션) |
| 시리얼 (`adapters/devices`) | `pyserial` + 실제 포트 | `SIM` 포트 명시 시 명령별 모의 응답 |

12주차 시점에 펌웨어 보드가 도착하기 전부터 발급·입장·반납 상태 기계 전체를 노트북 단독으로 검증할 수 있었다 — 하드웨어 의존성이 일정 리스크가 되는 IoT 프로젝트에서 결정적인 차이를 만들었다.

각 모드는 운영자 페이지 상단 배지에서 실시간 확인 가능. `ToggleService.toggle` 로 BLE/Face 백엔드 hot-swap.

## ⑩ 소프트웨어 측 결정 — 헥사고날 + 빌드 0

- `domain/` 은 numpy 외 import 0 · `application/` 은 포트만 의존 · `adapters/` 가 FastAPI/bleak/pyserial/SQLite 와 통신 — 자세한 계층 규칙은 [`architecture.md`](architecture.md)
- **자체 서명 TLS 자동 발급** — 노트북의 모든 LAN IP 를 SAN 에 포함해 부팅 시 생성. 태블릿 `getUserMedia` 가 요구하는 secure context 를 코드 수정 없이 충족
- `python run.py` 한 줄, 빌드 단계 0. argparse / 패키지 설치 불필요 — IoT 데모 환경에서 "그냥 켜면 돌아간다" 가 가장 중요
