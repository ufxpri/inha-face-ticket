// FaceTicket Wristband — ESP32-C3 BLE Peripheral 테스트 펌웨어
// 노트북 쪽 software/ble_client.py 의 RealBLEBackend 와 페어링됨.
//
// 프로토콜 (config.py 와 일치)
//   Service  12345678-1234-5678-1234-56789abcdef0
//   chr ...f1  Embedding  R/W  2048 B (float32 x 512) — Long Write 필요
//   chr ...f2  Seat       R/W  UTF-8
//   chr ...f3  Flag       R    1 B (체결 플래그; 본 테스트에선 GPIO9 BOOT 버튼 상태 미러)
//   chr ...f4  LED        W    1 B (0x00 OFF / 0x01 SUCCESS / 0x02 FAILURE / 0x03 ISSUED)
//   chr ...f5  ID         R    UTF-8 (MAC 기반 고정 ID)

#include <Arduino.h>
#include <NimBLEDevice.h>
#include <Wire.h>
#include <U8g2lib.h>

// ── OLED 0.42" 72x40 (ESP32-C3 보드 내장, SSD1306) ────────────
// 이 보드 OLED는 SSD1306 컨트롤러. U8g2 전용 생성자가 72x40 윈도우 오프셋을 자동 처리.
#define OLED_SDA 5
#define OLED_SCL 6
U8G2_SSD1306_72X40_ER_F_HW_I2C display(U8G2_R0, /*reset=*/U8X8_PIN_NONE, /*scl=*/OLED_SCL, /*sda=*/OLED_SDA);

// ── 핀 ────────────────────────────────────────────────────────
#define PIN_LED  8         // 보드 내장 LED (active-low)
#define PIN_BOOT 9         // BOOT 버튼 — 체결 플래그 시뮬레이션

// ── UUID ──────────────────────────────────────────────────────
static const char* SVC_UUID      = "12345678-1234-5678-1234-56789abcdef0";
static const char* CHR_EMBEDDING = "12345678-1234-5678-1234-56789abcdef1";
static const char* CHR_SEAT      = "12345678-1234-5678-1234-56789abcdef2";
static const char* CHR_FLAG      = "12345678-1234-5678-1234-56789abcdef3";
static const char* CHR_LED       = "12345678-1234-5678-1234-56789abcdef4";
static const char* CHR_ID        = "12345678-1234-5678-1234-56789abcdef5";
static const char* CHR_EMB_OFF   = "12345678-1234-5678-1234-56789abcdef6";  // read offset 컨트롤
static const size_t CHUNK_MAX    = 256;  // read 시 반환 청크 크기

static const char* DEVICE_NAME   = "FaceTicket-Wristband";
static const size_t EMBED_BYTES  = 512 * 4;

// ── 상태 ──────────────────────────────────────────────────────
static String  g_id          = "WB-XXXXXX";
static String  g_seat        = "";
static uint8_t g_last_led    = 0xFF;
static uint8_t g_embedding[EMBED_BYTES] = {0};
static bool    g_connected   = false;
static uint16_t g_read_off   = 0;  // 다음 read 가 반환할 시작 오프셋

// ── OLED ──────────────────────────────────────────────────────
static void oledDraw() {
  display.clearBuffer();
  display.setFont(u8g2_font_5x7_tf);
  int y = 8;
  display.drawStr(0, y, g_connected ? "BLE:CONN" : "BLE:ADV"); y += 9;
  display.drawStr(0, y, g_id.c_str());                         y += 9;
  String s = "S:" + (g_seat.length() ? g_seat : String("-"));
  display.drawStr(0, y, s.c_str());                            y += 9;
  char ll[12];
  if (g_last_led == 0xFF) snprintf(ll, sizeof(ll), "L:--");
  else                    snprintf(ll, sizeof(ll), "L:%02X", g_last_led);
  display.drawStr(0, y, ll);
  display.sendBuffer();
}

// ── BLE 콜백 ──────────────────────────────────────────────────
class ServerCB : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* s, ble_gap_conn_desc* d) override {
    g_connected = true;
    Serial.println("[BLE] connected");
    digitalWrite(PIN_LED, LOW);   // active-low → ON
    oledDraw();
  }
  void onDisconnect(NimBLEServer* s) override {
    g_connected = false;
    Serial.println("[BLE] disconnected — 광고 재개");
    digitalWrite(PIN_LED, HIGH);
    NimBLEDevice::startAdvertising();
    oledDraw();
  }
};

// Embedding write: payload = [u16_le offset][data], data 길이 ≤ 256B
class EmbedCB : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* c) override {
    std::string v = c->getValue();
    if (v.size() < 2) return;  // 헤더 부족
    uint16_t off = (uint8_t)v[0] | ((uint16_t)(uint8_t)v[1] << 8);
    size_t dlen = v.size() - 2;
    if (off >= EMBED_BYTES) return;
    if (off + dlen > EMBED_BYTES) dlen = EMBED_BYTES - off;
    memcpy(g_embedding + off, v.data() + 2, dlen);
    Serial.printf("[BLE] embedding chunk off=%u len=%u\n", off, (unsigned)dlen);
  }
  // Read: 현재 g_read_off 부터 CHUNK_MAX 바이트 반환
  void onRead(NimBLECharacteristic* c) override {
    uint16_t off = g_read_off;
    if (off >= EMBED_BYTES) { c->setValue((uint8_t*)"", 0); return; }
    size_t n = EMBED_BYTES - off;
    if (n > CHUNK_MAX) n = CHUNK_MAX;
    c->setValue(g_embedding + off, n);
  }
};

// read_offset write: u16_le 로 다음 read 청크의 시작 오프셋 설정
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
    // 간단한 시각 피드백 (active-low LED)
    for (int i = 0; i < (g_last_led & 0x07); i++) {
      digitalWrite(PIN_LED, LOW);  delay(80);
      digitalWrite(PIN_LED, HIGH); delay(80);
    }
    digitalWrite(PIN_LED, g_connected ? LOW : HIGH);
    oledDraw();
  }
};

class FlagCB : public NimBLECharacteristicCallbacks {
  void onRead(NimBLECharacteristic* c) override {
    uint8_t pressed = (digitalRead(PIN_BOOT) == LOW) ? 1 : 0;
    c->setValue(&pressed, 1);
  }
};

// ── 설정 ──────────────────────────────────────────────────────
static void makeId() {
  uint64_t mac = ESP.getEfuseMac();
  char buf[16];
  snprintf(buf, sizeof(buf), "WB-%06llX", mac & 0xFFFFFFULL);
  g_id = buf;
}

void setup() {
  Serial.begin(115200);
  delay(200);

  pinMode(PIN_LED, OUTPUT);
  digitalWrite(PIN_LED, HIGH);  // OFF (active-low)
  pinMode(PIN_BOOT, INPUT_PULLUP);

  // OLED (U8g2 SSD1306 72x40 전용 드라이버)
  display.begin();
  display.setContrast(255);
  display.clearBuffer();
  display.setFont(u8g2_font_5x7_tf);
  display.drawStr(0, 8, "BOOT...");
  display.sendBuffer();
  Serial.println("[OLED] init OK");

  makeId();
  Serial.printf("[ID] %s\n", g_id.c_str());

  // BLE
  NimBLEDevice::init(DEVICE_NAME);
  NimBLEDevice::setMTU(247);
  NimBLEDevice::setPower(ESP_PWR_LVL_P9);

  NimBLEServer* server = NimBLEDevice::createServer();
  server->setCallbacks(new ServerCB());

  NimBLEService* svc = server->createService(SVC_UUID);

  auto* cEmb = svc->createCharacteristic(
      CHR_EMBEDDING, NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::WRITE);
  cEmb->setValue(g_embedding, CHUNK_MAX);  // 초기값: 첫 256B
  cEmb->setCallbacks(new EmbedCB());

  auto* cOff = svc->createCharacteristic(
      CHR_EMB_OFF, NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR);
  cOff->setCallbacks(new EmbOffCB());

  auto* cSeat = svc->createCharacteristic(
      CHR_SEAT, NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::WRITE);
  cSeat->setValue(std::string(""));
  cSeat->setCallbacks(new SeatCB());

  auto* cFlag = svc->createCharacteristic(
      CHR_FLAG, NIMBLE_PROPERTY::READ);
  uint8_t z = 0; cFlag->setValue(&z, 1);
  cFlag->setCallbacks(new FlagCB());

  auto* cLed = svc->createCharacteristic(
      CHR_LED, NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR);
  cLed->setCallbacks(new LedCB());

  auto* cId = svc->createCharacteristic(
      CHR_ID, NIMBLE_PROPERTY::READ);
  cId->setValue(std::string(g_id.c_str()));

  svc->start();

  NimBLEAdvertising* adv = NimBLEDevice::getAdvertising();
  adv->addServiceUUID(SVC_UUID);
  adv->setScanResponse(true);
  adv->setName(DEVICE_NAME);
  NimBLEDevice::startAdvertising();

  Serial.println("[BLE] 광고 시작 — FaceTicket-Wristband");
  oledDraw();
}

// ── USB-CDC 명령 핸들러 (EntryDevice 와 짝) ───────────────────
// 라인 단위 텍스트 프로토콜:
//   WAKE   → OK         (이미 광고 중이라 noop, LED 짧게 깜빡)
//   PASS   → OK         (LED 0x01 + OLED L:01)
//   DENY   → OK         (LED 0x02)
//   CLEAR  → OK         (즉시)
//   PING   → OK PONG
//   기타   → ERR UNKNOWN <cmd>
//
// 주의: 이 USB-CDC 포트는 `pio device monitor` 와 동시에 잡을 수 없다.
//       모니터링 중이면 EntryDevice 가 포트를 못 연다.

static void applyLedEffect(uint8_t code) {
  g_last_led = code;
  for (int i = 0; i < (code & 0x07); i++) {
    digitalWrite(PIN_LED, LOW);  delay(60);
    digitalWrite(PIN_LED, HIGH); delay(60);
  }
  digitalWrite(PIN_LED, g_connected ? LOW : HIGH);
  oledDraw();
}

static String g_cdc_buf = "";

static void handleCdcLine(const String& raw) {
  String cmd = raw;
  cmd.trim();
  cmd.toUpperCase();
  if (cmd.length() == 0) return;

  if (cmd == "WAKE") {
    // 디버그용 짧은 LED 깜빡
    digitalWrite(PIN_LED, LOW); delay(40);
    digitalWrite(PIN_LED, HIGH);
    digitalWrite(PIN_LED, g_connected ? LOW : HIGH);
    Serial.println("OK");
  } else if (cmd == "PASS") {
    applyLedEffect(0x01);
    Serial.println("OK");
  } else if (cmd == "DENY") {
    applyLedEffect(0x02);
    Serial.println("OK");
  } else if (cmd == "CLEAR") {
    Serial.println("OK");
  } else if (cmd == "PING") {
    Serial.println("OK PONG");
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
    } else {
      if (g_cdc_buf.length() < 64) g_cdc_buf += c;
    }
  }
}

void loop() {
  // USB-CDC 라인 처리 (EntryDevice 명령)
  pollCdc();

  // 광고 중 LED 호흡 효과
  static uint32_t t = 0;
  if (!g_connected && millis() - t > 1500) {
    t = millis();
    digitalWrite(PIN_LED, LOW);  delay(30);
    digitalWrite(PIN_LED, HIGH);
  }
  delay(10);
}
