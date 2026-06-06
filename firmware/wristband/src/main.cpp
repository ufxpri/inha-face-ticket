// FaceTicket Wristband — ESP32-C3 ESP-NOW ↔ BLE 모드 전환 펌웨어
//
// ★ 단일 라디오 정책: ESP32-C3 는 BLE/WiFi 가 단일 2.4GHz 라디오라 둘을 동시에
//   쓰면(coexistence) 부팅 크래시 / BLE GATT 행이 발생한다(실측). 그래서 coex 를
//   버리고, 한 번에 하나의 라디오만 켜는 "명시적 모드 전환" 방식으로 교체했다.
//     MODE_ESPNOW : WiFi/ESP-NOW 만 활성 (RGB 수신 + NFC 트리거 대기)
//     MODE_BLE    : NimBLE 만 활성 (임베딩/좌석/플래그/LED/ID + 제어 char)
//   부팅은 MODE_ESPNOW 로 시작. NFC(ST25DV) RF 쓰기 → GPO 인터럽트 → BLE 모드 진입.
//   BLE 측에서 제어 char(...def7) write 또는 연결 종료/광고 타임아웃 → ESP-NOW 복귀.
//
// ★ 안전 규칙: 라디오 init/deinit 은 절대 ISR / BLE 콜백 안에서 하지 않는다.
//   ISR/콜백은 volatile 플래그만 세팅하고, 실제 전환은 loop() 에서 수행한다.
//
// 프로토콜 (서버 server/src/faceticket/config/ble_uuids.py 와 정확히 일치)
//   BLE Service 12345678-1234-5678-1234-56789abcdef0
//     ...f1 Embedding R/W 2048B(float32 x512) — 청크(offset+data)
//     ...f2 Seat R/W / ...f3 Flag R / ...f4 LED W / ...f5 ID R / ...f6 read-offset W
//     ...f7 Control W (write → ESP-NOW 모드 복귀)  ← 본 펌웨어에서 신규 추가
//   ESP-NOW: 4B [F][T][ver=1][cmd] → RGB LED, channel 6
//
// 핀: OLED I2C SDA=5 SCL=6 / 온보드 LED=8(active-low) / BOOT=9
//     RGB R=2 G=1 B=0 / ST25DV GPO 인터럽트=7
//     ST25DV I2C USER=0x53 SYSTEM=0x57 DYNAMIC=0x2D

#include <Arduino.h>
#include <WiFi.h>
#include <esp_idf_version.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <NimBLEDevice.h>
#include <Wire.h>
#include <U8g2lib.h>

// ── OLED 0.42" 72x40 (ESP32-C3 보드 내장, SSD1306) ────────────
#define OLED_SDA 5
#define OLED_SCL 6
U8G2_SSD1306_72X40_ER_F_HW_I2C display(U8G2_R0, /*reset=*/U8X8_PIN_NONE, /*scl=*/OLED_SCL, /*sda=*/OLED_SDA);

// ── 핀 ────────────────────────────────────────────────────────
#define PIN_LED   8        // 보드 내장 LED (active-low)
#define PIN_BOOT  9        // BOOT 버튼 — 체결 플래그 시뮬레이션
#define PIN_GPO   7        // ST25DV GPO 인터럽트 (FALLING)
static const uint8_t PIN_RGB_B = 0;
static const uint8_t PIN_RGB_G = 1;
static const uint8_t PIN_RGB_R = 2;

// ── BLE UUID ──────────────────────────────────────────────────
static const char* SVC_UUID      = "12345678-1234-5678-1234-56789abcdef0";
static const char* CHR_EMBEDDING = "12345678-1234-5678-1234-56789abcdef1";
static const char* CHR_SEAT      = "12345678-1234-5678-1234-56789abcdef2";
static const char* CHR_FLAG      = "12345678-1234-5678-1234-56789abcdef3";
static const char* CHR_LED       = "12345678-1234-5678-1234-56789abcdef4";
static const char* CHR_ID        = "12345678-1234-5678-1234-56789abcdef5";
static const char* CHR_EMB_OFF   = "12345678-1234-5678-1234-56789abcdef6";
static const char* CHR_CTRL      = "12345678-1234-5678-1234-56789abcdef7";  // 신규: 모드 제어
static const size_t CHUNK_MAX    = 256;

static const char* DEVICE_NAME   = "FaceTicket-Wristband";
static const size_t EMBED_BYTES  = 512 * 4;

// ── ESP-NOW RGB ───────────────────────────────────────────────
static const uint8_t ESPNOW_CHANNEL    = 6;
static const uint8_t RGB_PACKET_MAGIC_0 = 'F';
static const uint8_t RGB_PACKET_MAGIC_1 = 'T';
static const uint8_t RGB_PACKET_VERSION = 1;

enum RgbCommand : uint8_t {
  RGB_CMD_OFF = 0,
  RGB_CMD_R   = 1,
  RGB_CMD_G   = 2,
  RGB_CMD_B   = 3,
};

struct RgbPacket {
  uint8_t magic0;
  uint8_t magic1;
  uint8_t version;
  uint8_t command;
};
static_assert(sizeof(RgbPacket) == 4, "RgbPacket must remain 4 bytes");

// ── ST25DV I2C ────────────────────────────────────────────────
static const uint8_t  ST25_USER_ADDR    = 0x53;
static const uint8_t  ST25_SYSTEM_ADDR  = 0x57;
static const uint8_t  ST25_DYNAMIC_ADDR = 0x2D;
static const uint8_t  NFC_TRIGGER_BLOCK = 8;
static const uint8_t  NFC_BLOCK_BYTES   = 4;
static const uint16_t NFC_TRIGGER_BYTE_ADDR = NFC_TRIGGER_BLOCK * NFC_BLOCK_BYTES;  // 32
static const uint8_t  NFC_WAKE_PAYLOAD[NFC_BLOCK_BYTES]  = {'F', 'T', 'W', 'K'};
static const uint8_t  NFC_CLEAR_PAYLOAD[NFC_BLOCK_BYTES] = {0x00, 0x00, 0x00, 0x00};

// SYSTEM 레지스터 주소
static const uint16_t ST25_REG_GPO          = 0x0000;  // GPO 설정 레지스터
static const uint16_t ST25_REG_I2C_PWD      = 0x0900;  // I2C 비밀번호 present 주소
static const uint16_t ST25_REG_GPO_CTRL_DYN = 0x2000;  // DYNAMIC: GPO_CTRL_Dyn

// ── 모드 상태 머신 ────────────────────────────────────────────
enum Mode { MODE_ESPNOW, MODE_BLE };
static Mode     g_mode         = MODE_ESPNOW;
static uint32_t g_bleEnteredAt = 0;
static const uint32_t BLE_ADV_TIMEOUT_MS = 20000;  // 클라이언트 미연결 시 ESP-NOW 복귀

// ISR / BLE 콜백에서 세팅되는 플래그 (실제 라디오 전환은 loop 에서만)
static volatile bool g_gpoFired       = false;  // ST25DV GPO ISR
static volatile bool g_switchToEspnow = false;  // BLE 제어 char / 연결종료 콜백

// ── 일반 상태 ─────────────────────────────────────────────────
static String   g_id          = "WB-XXXXXX";
static String   g_seat        = "";
static uint8_t  g_last_led    = 0xFF;
static uint8_t  g_embedding[EMBED_BYTES] = {0};   // 모드 전환 후에도 유지
static bool     g_connected   = false;
static uint16_t g_read_off    = 0;
static uint8_t  g_last_rgb    = RGB_CMD_OFF;

// 알림 LED(등록/입장/반납 시 BLE 로 받은 효과)는 3초만 유지하고 OFF 로 제어권 해제 —
// 그래야 이후 수동 RGB(ESP-NOW LED 패널) 색상이 묻히지 않는다. 수동 명령이 오면 즉시 취소.
static bool     g_notifyLedActive = false;
static uint32_t g_notifyLedAt     = 0;
static const uint32_t NOTIFY_LED_HOLD_MS = 3000;

static volatile bool    pendingRgbCommand = false;
static volatile uint8_t pendingRgbValue   = RGB_CMD_OFF;
static portMUX_TYPE     rgbMux = portMUX_INITIALIZER_UNLOCKED;

// ── RGB LED ───────────────────────────────────────────────────
static const char* rgbCommandName(uint8_t command) {
  if (command == RGB_CMD_R) return "R";
  if (command == RGB_CMD_G) return "G";
  if (command == RGB_CMD_B) return "B";
  return "OFF";
}

static void applyRgbCommand(uint8_t command) {
  digitalWrite(PIN_RGB_R, command == RGB_CMD_R ? HIGH : LOW);
  digitalWrite(PIN_RGB_G, command == RGB_CMD_G ? HIGH : LOW);
  digitalWrite(PIN_RGB_B, command == RGB_CMD_B ? HIGH : LOW);
  g_last_rgb = command;
  // 어떤 직접 RGB 세팅이든 알림 LED 제어권을 해제한다. 알림(LedCB) 경로는 이 호출
  // 직후 g_notifyLedActive 를 다시 무장하므로 영향 없음.
  g_notifyLedActive = false;
}

static bool parseRgbPacket(const uint8_t* data, int len, uint8_t* command) {
  if (len != (int)sizeof(RgbPacket)) return false;
  RgbPacket packet;
  memcpy(&packet, data, sizeof(packet));
  if (packet.magic0 != RGB_PACKET_MAGIC_0 || packet.magic1 != RGB_PACKET_MAGIC_1) return false;
  if (packet.version != RGB_PACKET_VERSION) return false;
  if (packet.command > RGB_CMD_B) return false;
  *command = packet.command;
  return true;
}

static void setPendingRgbCommand(uint8_t command) {
  portENTER_CRITICAL(&rgbMux);
  pendingRgbValue   = command;
  pendingRgbCommand = true;
  portEXIT_CRITICAL(&rgbMux);
}

// BLE LED 효과 코드(0x01 SUCCESS / 0x02 FAILURE / 0x03 ISSUED) → RGB 색 매핑.
static uint8_t ledCodeToRgb(uint8_t code) {
  switch (code & 0x07) {
    case 0x01: return RGB_CMD_G;   // SUCCESS
    case 0x02: return RGB_CMD_R;   // FAILURE
    case 0x03: return RGB_CMD_B;   // ISSUED
    default:   return RGB_CMD_OFF;
  }
}

// ── ST25DV I2C 헬퍼 ───────────────────────────────────────────
//   USER(0x53) 영역: 16-bit 메모리 주소로 블록 read/write (smoke 펌웨어 재사용).
//   SYSTEM(0x57)/DYNAMIC(0x2D): GPO 설정 및 비밀번호 present 용 write 헬퍼 추가.

static bool i2cPresent(uint8_t addr) {
  Wire.beginTransmission(addr);
  return Wire.endTransmission() == 0;
}

static bool st25ReadBytes(uint16_t byteAddr, uint8_t* out, uint8_t len) {
  Wire.beginTransmission(ST25_USER_ADDR);
  Wire.write((uint8_t)(byteAddr >> 8));
  Wire.write((uint8_t)(byteAddr & 0xFF));
  if (Wire.endTransmission(false) != 0) return false;

  uint8_t got = Wire.requestFrom((int)ST25_USER_ADDR, (int)len);
  if (got != len) return false;
  for (uint8_t i = 0; i < len; i++) {
    out[i] = Wire.read();
  }
  return true;
}

static bool st25WriteBytes(uint16_t byteAddr, const uint8_t* data, uint8_t len) {
  Wire.beginTransmission(ST25_USER_ADDR);
  Wire.write((uint8_t)(byteAddr >> 8));
  Wire.write((uint8_t)(byteAddr & 0xFF));
  for (uint8_t i = 0; i < len; i++) {
    Wire.write(data[i]);
  }
  if (Wire.endTransmission() != 0) return false;

  delay(8);
  uint8_t verify[NFC_BLOCK_BYTES] = {0};
  if (!st25ReadBytes(byteAddr, verify, len)) return false;
  return memcmp(verify, data, len) == 0;
}

// SYSTEM 영역(0x57) write — GPO 레지스터 / 비밀번호 present 용.
static bool st25WriteSystem(uint16_t byteAddr, const uint8_t* data, uint8_t len) {
  Wire.beginTransmission(ST25_SYSTEM_ADDR);
  Wire.write((uint8_t)(byteAddr >> 8));
  Wire.write((uint8_t)(byteAddr & 0xFF));
  for (uint8_t i = 0; i < len; i++) {
    Wire.write(data[i]);
  }
  if (Wire.endTransmission() != 0) return false;
  delay(8);
  return true;
}

// DYNAMIC 레지스터 write — GPO_CTRL_Dyn(0x2000) 등.
// ST25DV 동적 레지스터는 별도 디바이스가 아니라 USER 디바이스(0x53) 주소공간 0x2000+ 에 매핑됨.
// (0x2D 는 ACK 안 함 — 실측 확인.)
static bool st25WriteDynamic(uint16_t byteAddr, const uint8_t* data, uint8_t len) {
  Wire.beginTransmission(ST25_USER_ADDR);
  Wire.write((uint8_t)(byteAddr >> 8));
  Wire.write((uint8_t)(byteAddr & 0xFF));
  for (uint8_t i = 0; i < len; i++) {
    Wire.write(data[i]);
  }
  if (Wire.endTransmission() != 0) return false;
  delay(5);
  return true;
}

// I2C 보안 세션 열기 — 기본 비밀번호(8 x 0x00) present.
// SYSTEM(0x57) 0x0900 에 17바이트: [pwd 8B][0x09 검증코드][pwd 8B].
static bool st25PresentPassword() {
  uint8_t seq[17];
  for (uint8_t i = 0; i < 8; i++)  seq[i] = 0x00;       // password
  seq[8] = 0x09;                                        // validation code
  for (uint8_t i = 0; i < 8; i++)  seq[9 + i] = 0x00;   // password (재입력)
  return st25WriteSystem(ST25_REG_I2C_PWD, seq, sizeof(seq));
}

// ST25DV GPO 설정: RF 가 EEPROM 에 쓸 때 GPO 핀이 펄스를 내도록 구성.
// 어떤 단계가 실패해도 부팅을 하드페일하지 않는다(loop 의 폴링 폴백이 커버).
static void st25ConfigureGpo() {
  if (!i2cPresent(ST25_SYSTEM_ADDR)) {
    Serial.println("[ST25] SYSTEM(0x57) not found — GPO 설정 건너뜀");
    return;
  }

  // 1) 보안 세션 열기 (기본 비밀번호 present)
  if (st25PresentPassword()) {
    Serial.println("[ST25] password present OK");
  } else {
    Serial.println("[ST25] password present FAIL");
  }

  // 2) GPO 레지스터 = 0xC0 (bit7 GPO_EN | bit6 RF_WRITE_EN)
  uint8_t gpo = 0xC0;
  if (st25WriteSystem(ST25_REG_GPO, &gpo, 1)) {
    Serial.println("[ST25] GPO reg=0xC0 write OK");
  } else {
    Serial.println("[ST25] GPO reg write FAIL");
  }

  // 3) GPO_CTRL_Dyn bit0 = 1 (GPO 출력 활성)
  uint8_t dyn = 0x01;
  if (st25WriteDynamic(ST25_REG_GPO_CTRL_DYN, &dyn, 1)) {
    Serial.println("[ST25] GPO_CTRL_Dyn=0x01 write OK");
  } else {
    Serial.println("[ST25] GPO_CTRL_Dyn write FAIL");
  }
}

// ── ST25DV GPO ISR ────────────────────────────────────────────
// 절대 여기서 I2C/라디오를 만지지 않는다 — 플래그만 세팅.
static void IRAM_ATTR onGpoFalling() {
  g_gpoFired = true;
}

// block 8 을 읽어 wake 페이로드(FTWK)인지 확인. 맞으면 block 8 을 클리어하고 true.
static bool checkNfcTrigger() {
  uint8_t data[NFC_BLOCK_BYTES] = {0};
  if (!st25ReadBytes(NFC_TRIGGER_BYTE_ADDR, data, sizeof(data))) return false;
  if (memcmp(data, NFC_WAKE_PAYLOAD, NFC_BLOCK_BYTES) != 0) return false;

  Serial.println("[NFC] wake 트리거 감지 (FTWK)");
  // 트리거 소비 — block 8 클리어 (검증은 best-effort)
  if (!st25WriteBytes(NFC_TRIGGER_BYTE_ADDR, NFC_CLEAR_PAYLOAD, NFC_BLOCK_BYTES)) {
    Serial.println("[NFC] block8 클리어 실패(무시)");
  }
  return true;
}

// ── ESP-NOW (수신 전용 — RX 에는 peer 불필요) ────────────────
#if ESP_IDF_VERSION_MAJOR >= 5
static void onEspNowReceive(const esp_now_recv_info_t* recvInfo, const uint8_t* data, int len) {
  (void)recvInfo;
#else
static void onEspNowReceive(const uint8_t* mac, const uint8_t* data, int len) {
  (void)mac;
#endif
  uint8_t command = RGB_CMD_OFF;
  if (parseRgbPacket(data, len, &command)) {
    setPendingRgbCommand(command);   // 콜백 컨텍스트 — 실제 GPIO/Serial 은 loop 에서
  }
}

static void espNowBegin() {
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  esp_wifi_set_channel(ESPNOW_CHANNEL, WIFI_SECOND_CHAN_NONE);
  if (esp_now_init() != ESP_OK) {
    Serial.println("[ESPNOW] init failed");
    return;
  }
  esp_now_register_recv_cb(onEspNowReceive);
  Serial.printf("[ESPNOW] ready channel=%u mac=%s\n", ESPNOW_CHANNEL, WiFi.macAddress().c_str());
}

static void espNowEnd() {
  esp_now_unregister_recv_cb();
  esp_now_deinit();
  esp_wifi_stop();
  esp_wifi_deinit();
  WiFi.mode(WIFI_OFF);
}

// ── OLED ──────────────────────────────────────────────────────
static void oledDraw() {
  display.clearBuffer();
  display.setFont(u8g2_font_5x7_tf);
  int y = 8;
  // line1: 모드 / 연결 상태
  const char* l1 = "ESPNOW";
  if (g_mode == MODE_BLE) l1 = g_connected ? "BLE:CONN" : "BLE:ADV";
  display.drawStr(0, y, l1);                                   y += 9;
  // line2: ID
  display.drawStr(0, y, g_id.c_str());                         y += 9;
  // line3: 좌석
  String s = "S:" + (g_seat.length() ? g_seat : String("-"));
  display.drawStr(0, y, s.c_str());                            y += 9;
  // line4: RGB 색 + 마지막 LED 코드
  char ll[20];
  snprintf(ll, sizeof(ll), "%s C:%s",
           (g_last_led == 0xFF) ? "L:--" : (String("L:") + String(g_last_led, HEX)).c_str(),
           rgbCommandName(g_last_rgb));
  display.drawStr(0, y, ll);
  display.sendBuffer();
}

// ── BLE 콜백 ──────────────────────────────────────────────────
class ServerCB : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* s, ble_gap_conn_desc* d) override {
    g_connected = true;
    Serial.println("[BLE] connected");
    digitalWrite(PIN_LED, LOW);
    oledDraw();
  }
  void onDisconnect(NimBLEServer* s) override {
    g_connected = false;
    Serial.println("[BLE] disconnected — ESP-NOW 모드로 복귀 예약");
    digitalWrite(PIN_LED, HIGH);
    // 광고를 재개하지 않고 ESP-NOW 모드로 빠져나간다. 실제 전환은 loop 에서.
    g_switchToEspnow = true;
  }
};

class EmbedCB : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* c) override {
    std::string v = c->getValue();
    if (v.size() < 2) return;
    uint16_t off = (uint8_t)v[0] | ((uint16_t)(uint8_t)v[1] << 8);
    size_t dlen = v.size() - 2;
    if (off >= EMBED_BYTES) return;
    if (off + dlen > EMBED_BYTES) dlen = EMBED_BYTES - off;
    memcpy(g_embedding + off, v.data() + 2, dlen);
    Serial.printf("[BLE] embedding chunk off=%u len=%u\n", off, (unsigned)dlen);
  }
  void onRead(NimBLECharacteristic* c) override {
    uint16_t off = g_read_off;
    if (off >= EMBED_BYTES) { c->setValue((uint8_t*)"", 0); return; }
    size_t n = EMBED_BYTES - off;
    if (n > CHUNK_MAX) n = CHUNK_MAX;
    c->setValue(g_embedding + off, n);
  }
};

class EmbOffCB : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* c) override {
    std::string v = c->getValue();
    if (v.size() < 2) return;
    g_read_off = (uint8_t)v[0] | ((uint16_t)(uint8_t)v[1] << 8);
    Serial.printf("[BLE] read offset = %u\n", g_read_off);
  }
};

class SeatCB : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* c) override {
    g_seat = String(c->getValue().c_str());
    Serial.printf("[BLE] seat write: %s\n", g_seat.c_str());
    oledDraw();
  }
};

class LedCB : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* c) override {
    std::string v = c->getValue();
    if (v.empty()) return;
    g_last_led = (uint8_t)v[0];
    Serial.printf("[BLE] LED effect: 0x%02X\n", g_last_led);
    // 온보드 LED 깜빡 (코드 하위 3비트 횟수)
    for (int i = 0; i < (g_last_led & 0x07); i++) {
      digitalWrite(PIN_LED, LOW);  delay(80);
      digitalWrite(PIN_LED, HIGH); delay(80);
    }
    digitalWrite(PIN_LED, g_connected ? LOW : HIGH);
    // RGB LED 에도 색으로 반영 (SUCCESS=G / FAILURE=R / ISSUED=B / 그 외=OFF)
    uint8_t rgb = ledCodeToRgb(g_last_led);
    applyRgbCommand(rgb);
    // 알림 색이면 3초 뒤 자동 해제하도록 타이머 무장 (loop 에서 만료 처리)
    g_notifyLedActive = (rgb != RGB_CMD_OFF);
    g_notifyLedAt = millis();
    oledDraw();
  }
};

class FlagCB : public NimBLECharacteristicCallbacks {
  void onRead(NimBLECharacteristic* c) override {
    uint8_t pressed = (digitalRead(PIN_BOOT) == LOW) ? 1 : 0;
    c->setValue(&pressed, 1);
  }
};

// 신규 제어 char(...f7): write 가 오면 ESP-NOW 모드 복귀 예약.
class CtrlCB : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* c) override {
    (void)c;
    Serial.println("[BLE] CTRL write — ESP-NOW 모드로 복귀 예약");
    g_switchToEspnow = true;
  }
};

// ── ID 생성 ───────────────────────────────────────────────────
static void makeId() {
  uint64_t mac = ESP.getEfuseMac();
  char buf[16];
  snprintf(buf, sizeof(buf), "WB-%06llX", mac & 0xFFFFFFULL);
  g_id = buf;
}

// ── BLE init / deinit ─────────────────────────────────────────
// GATT 는 한 번만 만들고 재사용한다. 매 진입마다 재생성하면 데이터베이스가 바뀌어 재연결 시
// Service Changed 인디케이션이 발생 → 호스트(bleak)가 GATT 캐시를 무효화하며 멈출 수 있다.
// (NimBLE 는 deinit 후 GATT 를 보존하지 못해 매번 재생성한다.)
static void bleBuildGatt() {
  NimBLEServer* server = NimBLEDevice::createServer();
  server->setCallbacks(new ServerCB());

  NimBLEService* svc = server->createService(SVC_UUID);

  auto* cEmb = svc->createCharacteristic(
      CHR_EMBEDDING, NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::WRITE);
  cEmb->setValue(g_embedding, CHUNK_MAX);
  cEmb->setCallbacks(new EmbedCB());

  auto* cOff = svc->createCharacteristic(
      CHR_EMB_OFF, NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR);
  cOff->setCallbacks(new EmbOffCB());

  auto* cSeat = svc->createCharacteristic(
      CHR_SEAT, NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::WRITE);
  cSeat->setValue(std::string(g_seat.c_str()));
  cSeat->setCallbacks(new SeatCB());

  auto* cFlag = svc->createCharacteristic(CHR_FLAG, NIMBLE_PROPERTY::READ);
  uint8_t z = 0; cFlag->setValue(&z, 1);
  cFlag->setCallbacks(new FlagCB());

  auto* cLed = svc->createCharacteristic(
      CHR_LED, NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR);
  cLed->setCallbacks(new LedCB());

  auto* cId = svc->createCharacteristic(CHR_ID, NIMBLE_PROPERTY::READ);
  cId->setValue(std::string(g_id.c_str()));

  auto* cCtrl = svc->createCharacteristic(
      CHR_CTRL, NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR);
  cCtrl->setCallbacks(new CtrlCB());

  svc->start();
}

static void bleBegin() {
  NimBLEDevice::init(DEVICE_NAME);
  NimBLEDevice::setMTU(247);
  NimBLEDevice::setPower(ESP_PWR_LVL_P9);

  // NimBLE 는 deinit 후 서비스를 보존/재등록하지 못하므로 매 진입마다 GATT 를 새로 생성한다.
  // (재연결 시 Service Changed 가 발생하지만, 서버 측 bleak 을 전용 루프에서 돌려 처리한다.)
  bleBuildGatt();

  NimBLEAdvertising* adv = NimBLEDevice::getAdvertising();
  adv->addServiceUUID(SVC_UUID);
  adv->setScanResponse(true);
  adv->setName(DEVICE_NAME);
  NimBLEDevice::startAdvertising();
  Serial.println("[BLE] 광고 시작 — FaceTicket-Wristband");
}

static void bleEnd() {
  NimBLEDevice::stopAdvertising();
  // 연결된 클라이언트가 있으면 끊는다.
  NimBLEServer* server = NimBLEDevice::getServer();
  if (server != nullptr) {
    std::vector<uint16_t> peers = server->getPeerDevices();
    for (uint16_t h : peers) {
      server->disconnect(h);
    }
  }
  delay(50);
  // ※ esp_bt_mem_release 는 절대 호출하지 않는다 — 다음 사이클에 BLE 를 재init 한다.
  NimBLEDevice::deinit(true);
  g_connected = false;
}

// ── 모드 전환 (loop 에서만 호출) ──────────────────────────────
static void enterBleMode() {
  Serial.println("[MODE] ESPNOW->BLE");
  espNowEnd();
  bleBegin();
  g_mode          = MODE_BLE;
  g_bleEnteredAt  = millis();
  g_switchToEspnow = false;
  oledDraw();
}

static void enterEspnowMode() {
  Serial.println("[MODE] BLE->ESPNOW");
  bleEnd();
  espNowBegin();
  g_mode = MODE_ESPNOW;
  oledDraw();
}

// ── 설정 ──────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(200);

  pinMode(PIN_LED, OUTPUT);
  digitalWrite(PIN_LED, HIGH);   // OFF (active-low)
  pinMode(PIN_BOOT, INPUT_PULLUP);
  pinMode(PIN_RGB_R, OUTPUT);
  pinMode(PIN_RGB_G, OUTPUT);
  pinMode(PIN_RGB_B, OUTPUT);
  applyRgbCommand(RGB_CMD_OFF);

  display.begin();
  display.setContrast(255);
  display.clearBuffer();
  display.setFont(u8g2_font_5x7_tf);
  display.drawStr(0, 8, "BOOT...");
  display.sendBuffer();
  Serial.println("[OLED] init OK");

  makeId();
  Serial.printf("[ID] %s\n", g_id.c_str());

  // OLED + ST25DV 가 공유하는 I2C 버스
  Wire.begin(OLED_SDA, OLED_SCL);
  Wire.setClock(100000);

  // ST25DV GPO: RF 쓰기 시 펄스 출력하도록 설정 (실패해도 부팅 계속)
  st25ConfigureGpo();

  // GPIO7 FALLING 인터럽트 — GPO 펄스 감지
  pinMode(PIN_GPO, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_GPO), onGpoFalling, FALLING);

  // 부팅은 ESP-NOW 모드로 시작
  espNowBegin();
  g_mode = MODE_ESPNOW;
  Serial.println("[MODE] ESPNOW");

  oledDraw();
}

// ── USB-CDC 디버그 명령 ───────────────────────────────────────
//   PING->OK PONG, RGB R/G/B/OFF 수동, MODE(현재 모드 출력)
static String g_cdc_buf = "";

static const char* modeName() {
  if (g_mode == MODE_BLE) return g_connected ? "BLE:CONN" : "BLE:ADV";
  return "ESPNOW";
}

static void handleCdcLine(const String& raw) {
  String cmd = raw;
  cmd.trim();
  cmd.toUpperCase();
  if (cmd.length() == 0) return;

  if (cmd == "PING") {
    Serial.println("OK PONG");
  } else if (cmd == "MODE") {
    Serial.printf("OK MODE=%s\n", modeName());
  } else if (cmd == "GOBLE") {
    // 디버그: 리더 없이 ESP-NOW→BLE 강제 전환 (라디오 재init 안정성 테스트용). loop 컨텍스트라 안전.
    if (g_mode == MODE_ESPNOW) { enterBleMode(); Serial.println("OK GOBLE"); }
    else Serial.println("OK ALREADY-BLE");
  } else if (cmd == "TRIGNFC") {
    // 디버그: 리더 없이 NFC 트리거 시뮬레이션 — block8 에 FTWK 직접 write → loop 폴링이 감지해 전환.
    bool ok = st25WriteBytes(NFC_TRIGGER_BYTE_ADDR, NFC_WAKE_PAYLOAD, NFC_BLOCK_BYTES);
    Serial.printf("OK TRIGNFC write=%d\n", ok);
  } else if (cmd == "RGB R" || cmd == "LED R" || cmd == "R") {
    applyRgbCommand(RGB_CMD_R); oledDraw(); Serial.println("OK RGB=R");
  } else if (cmd == "RGB G" || cmd == "LED G" || cmd == "G") {
    applyRgbCommand(RGB_CMD_G); oledDraw(); Serial.println("OK RGB=G");
  } else if (cmd == "RGB B" || cmd == "LED B" || cmd == "B") {
    applyRgbCommand(RGB_CMD_B); oledDraw(); Serial.println("OK RGB=B");
  } else if (cmd == "RGB OFF" || cmd == "LED OFF" || cmd == "OFF") {
    applyRgbCommand(RGB_CMD_OFF); oledDraw(); Serial.println("OK RGB=OFF");
  } else {
    Serial.print("ERR UNKNOWN ");
    Serial.println(cmd);
  }
}

static void pollCdc() {
  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    if (c == '\r') continue;
    if (c == '\n') {
      handleCdcLine(g_cdc_buf);
      g_cdc_buf = "";
    } else if (g_cdc_buf.length() < 64) {
      g_cdc_buf += c;
    }
  }
}

// ── loop ──────────────────────────────────────────────────────
void loop() {
  pollCdc();

  // 알림 LED 3초 만료 → OFF 로 제어권 해제 (모드 무관, RGB 핀은 라디오와 독립)
  if (g_notifyLedActive && (millis() - g_notifyLedAt > NOTIFY_LED_HOLD_MS)) {
    g_notifyLedActive = false;
    applyRgbCommand(RGB_CMD_OFF);
    oledDraw();
    Serial.println("OK NOTIFY-LED expired -> OFF");
  }

  if (g_mode == MODE_ESPNOW) {
    // ESP-NOW 로 들어온 RGB 명령 적용 (콜백에서 큐잉된 것)
    bool hasRgb = false;
    uint8_t rgb = RGB_CMD_OFF;
    portENTER_CRITICAL(&rgbMux);
    if (pendingRgbCommand) {
      rgb = pendingRgbValue;
      pendingRgbCommand = false;
      hasRgb = true;
    }
    portEXIT_CRITICAL(&rgbMux);
    if (hasRgb) {
      applyRgbCommand(rgb);   // 수동 명령 — applyRgbCommand 가 알림 타이머 해제
      oledDraw();
      Serial.printf("OK ESPNOW RGB=%s\n", rgbCommandName(rgb));
    }

    // NFC 트리거 검사: GPO 인터럽트가 발생했거나, 저빈도 폴링 폴백(~1000ms).
    static uint32_t lastPoll = 0;
    bool fired = false;
    if (g_gpoFired) {
      g_gpoFired = false;
      fired = true;
    }
    if (fired || (millis() - lastPoll > 1000)) {
      lastPoll = millis();
      if (checkNfcTrigger()) {
        enterBleMode();
      }
    }

    // 광고/대기 중 온보드 LED 호흡
    static uint32_t t = 0;
    if (millis() - t > 1500) {
      t = millis();
      digitalWrite(PIN_LED, LOW);  delay(30);
      digitalWrite(PIN_LED, HIGH);
    }
  } else {  // MODE_BLE
    if (g_switchToEspnow) {
      enterEspnowMode();
    } else if (!g_connected && (millis() - g_bleEnteredAt > BLE_ADV_TIMEOUT_MS)) {
      // 광고 타임아웃 폴백 — 아무도 안 붙으면 ESP-NOW 로 복귀
      Serial.println("[MODE] BLE 광고 타임아웃 — ESP-NOW 복귀");
      enterEspnowMode();
    }
  }

  delay(10);
}
