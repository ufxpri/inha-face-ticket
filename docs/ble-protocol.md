# BLE GATT 프로토콜

ESP32-C3 팔찌 (`firmware/wristband`) 의 BLE peripheral 정의. 서버 측 정의는 `server/src/faceticket/config/ble_uuids.py`.

## 장치명 + 서비스

- 광고명: `FaceTicket-Wristband`
- Service UUID: `12345678-1234-5678-1234-56789abcdef0`

## Characteristics

| UUID                                    | 이름             | 동작        | 포맷 |
|---|---|---|---|
| `…56789abcdef1` | `CHR_EMBEDDING` | read/write  | 청크 단위 — 아래 청킹 프로토콜 참조 |
| `…56789abcdef6` | `CHR_EMB_OFF`   | write       | u16_le — 다음 read 청크의 시작 오프셋 |
| `…56789abcdef2` | `CHR_SEAT`      | read/write  | UTF-8 문자열 |
| `…56789abcdef3` | `CHR_FLAG`      | read        | 1 byte (0 = 체결 유지, 1 = 분리 감지) |
| `…56789abcdef4` | `CHR_LED`       | write       | 1 byte 효과 코드 (`led_codes.py`) |
| `…56789abcdef5` | `CHR_ID`        | read        | UTF-8 팔찌 ID |

## 청킹 프로토콜

`EMBED_DIM × 4 = 2048 B` 는 BLE 단일 attribute 한계 (512 B) 를 초과. 앱 레벨에서 `EMBED_CHUNK = 256 B` 분할.

**Write 흐름** — 임베딩 전체를 처음부터 차례로:

```
for off in 0, 256, 512, …, 1792:
    payload = [u16_le(off)] + data[off : off+256]
    write_gatt_char(CHR_EMBEDDING, payload, response=True)
```

**Read 흐름** — 청크별로 오프셋 지정 후 read:

```
for off in 0, 256, 512, …, 1792:
    write_gatt_char(CHR_EMB_OFF, u16_le(off), response=True)
    chunk = read_gatt_char(CHR_EMBEDDING)        # 최대 256 B
    buf[off : off+len(chunk)] = chunk
```

펌웨어 측은 직전 `CHR_EMB_OFF` write 의 오프셋부터 256 B 잘라서 응답.

## LED 효과 코드 (`CHR_LED`)

| 코드 | 의미 |
|---|---|
| `0x00` | OFF |
| `0x01` | SUCCESS (입장 통과) |
| `0x02` | FAILURE (인증 실패 / 분리 감지) |
| `0x03` | ISSUED (발급 완료) |

## 체결 플래그 (`CHR_FLAG`)

팔찌 잠금이 한 번이라도 분리됐다 다시 체결되면 펌웨어가 plaintext flag = 1 로 토글. 입장 시 서버가 read 해 1 이면 `signal_deny` + LED_FAILURE.

## 변경 시 주의

UUID 또는 청크 크기를 바꾸면 펌웨어와 서버 양쪽을 동시 업데이트. 서버 측 상수는 `config/ble_uuids.py`, 펌웨어는 `firmware/wristband/src/main.cpp`.
