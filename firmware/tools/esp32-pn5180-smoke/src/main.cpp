// ESP32-C3 + PN5180 ISO15693 smoke test.
//
// Wiring:
//   PN5180 5V    -> ESP32-C3 5V
//   PN5180 3.3V  -> ESP32-C3 3.3V
//   PN5180 GND   -> ESP32-C3 GND
//   PN5180 NSS   -> GPIO10
//   PN5180 MOSI  -> GPIO7
//   PN5180 MISO  -> GPIO3
//   PN5180 SCK   -> GPIO4
//   PN5180 BUSY  -> GPIO20
//   PN5180 RST   -> GPIO21
//   PN5180 IRQ/GPIO/AUX/REQ unused
//
// Serial commands:
//   PING, STATUS, RFON, RFOFF, INVENTORY, WAKE, CLEAR, PASS, DENY
//   RGB R, RGB G, RGB B, RGB OFF

#include <Arduino.h>
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <SPI.h>
#include <Wire.h>
#include <U8g2lib.h>

// ── 디버그 OLED (ESP32-C3 보드 내장 0.42" 72x40 SSD1306, GPIO5/6) ──
// PN5180 은 SPI(3/4/7/10/20/21) 라 I2C(5/6) 와 겹치지 않는다. 내장 OLED 가 없는
// 보드라면 외부 SSD1306 을 SDA=5/SCL=6 에 연결하면 동일하게 동작.
#define OLED_SDA 5
#define OLED_SCL 6
static U8G2_SSD1306_72X40_ER_F_HW_I2C oled(U8G2_R0, U8X8_PIN_NONE, OLED_SCL, OLED_SDA);

// 리셋/크래시 감지용 부팅 카운터 — RTC 메모리라 소프트리셋/크래시엔 유지(완전 정전엔 0).
RTC_DATA_ATTR static uint32_t g_bootCount = 0;
static String g_lastCmd    = "-";
static String g_lastResult = "-";
static uint32_t g_lastCmdAt = 0;

static const uint8_t PIN_NFC_NSS = 10;
static const uint8_t PIN_NFC_MOSI = 7;
static const uint8_t PIN_NFC_MISO = 3;
static const uint8_t PIN_NFC_SCK = 4;
static const uint8_t PIN_NFC_BUSY = 20;
static const uint8_t PIN_NFC_RST = 21;

static const uint8_t NFC_TRIGGER_BLOCK = 8;
static const uint8_t NFC_BLOCK_BYTES = 4;
static const uint16_t NFC_TIMEOUT_MS = 900;
static const uint8_t NFC_WAKE_PAYLOAD[NFC_BLOCK_BYTES] = {'F', 'T', 'W', 'K'};
static const uint8_t NFC_CLEAR_PAYLOAD[NFC_BLOCK_BYTES] = {0x00, 0x00, 0x00, 0x00};

static const uint8_t ESPNOW_CHANNEL = 6;
static const uint8_t ESPNOW_BROADCAST_MAC[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
static const uint8_t RGB_PACKET_MAGIC_0 = 'F';
static const uint8_t RGB_PACKET_MAGIC_1 = 'T';
static const uint8_t RGB_PACKET_VERSION = 1;

enum RgbCommand : uint8_t {
  RGB_CMD_OFF = 0,
  RGB_CMD_R = 1,
  RGB_CMD_G = 2,
  RGB_CMD_B = 3,
};

struct RgbPacket {
  uint8_t magic0;
  uint8_t magic1;
  uint8_t version;
  uint8_t command;
};
static_assert(sizeof(RgbPacket) == 4, "RgbPacket must remain 4 bytes");

static const uint8_t PN5180_WRITE_REGISTER = 0x00;
static const uint8_t PN5180_WRITE_REGISTER_OR_MASK = 0x01;
static const uint8_t PN5180_WRITE_REGISTER_AND_MASK = 0x02;
static const uint8_t PN5180_READ_REGISTER = 0x04;
static const uint8_t PN5180_SEND_DATA = 0x09;
static const uint8_t PN5180_READ_DATA = 0x0A;
static const uint8_t PN5180_LOAD_RF_CONFIG = 0x11;
static const uint8_t PN5180_RF_ON = 0x16;
static const uint8_t PN5180_RF_OFF = 0x17;

static const uint8_t REG_SYSTEM_CONFIG = 0x00;
static const uint8_t REG_IRQ_STATUS = 0x02;
static const uint8_t REG_IRQ_CLEAR = 0x03;
static const uint8_t REG_RX_STATUS = 0x13;
static const uint32_t IRQ_RX = 1UL << 0;
static const uint32_t IRQ_IDLE = 1UL << 2;
static const uint32_t IRQ_TX_RF_OFF = 1UL << 8;
static const uint32_t IRQ_TX_RF_ON = 1UL << 9;

static const uint8_t ISO15693_FLAGS_INVENTORY_1_SLOT = 0x26;
static const uint8_t ISO15693_FLAGS_ADDRESSED = 0x22;
static const uint8_t ISO15693_CMD_INVENTORY = 0x01;
static const uint8_t ISO15693_CMD_READ_SINGLE_BLOCK = 0x20;
static const uint8_t ISO15693_CMD_WRITE_SINGLE_BLOCK = 0x21;

enum NfcResult {
  NFC_RESULT_OK,
  NFC_RESULT_READER_FAILED,
  NFC_RESULT_RF_FAILED,
  NFC_RESULT_NO_TAG,
  NFC_RESULT_WRITE_FAILED,
  NFC_RESULT_VERIFY_FAILED,
};

static SPISettings nfcSpiSettings(125000, MSBFIRST, SPI_MODE0);
static String serialBuf;
static bool espnowReady = false;

static const char* rgbCommandName(RgbCommand command) {
  if (command == RGB_CMD_R) return "R";
  if (command == RGB_CMD_G) return "G";
  if (command == RGB_CMD_B) return "B";
  return "OFF";
}

static void setResult(const String& r) { g_lastResult = r; }

// 디버그 OLED 그리기 — 부팅횟수(리셋감지) / ESP-NOW 상태 / 가동시간·heap /
// 마지막 명령 / 마지막 결과. 72x40 이라 5줄, 5x7 폰트.
static void drawDebug() {
  uint32_t up = millis() / 1000;
  uint32_t heapK = ESP.getFreeHeap() / 1024;
  char l[24];
  oled.clearBuffer();
  oled.setFont(u8g2_font_5x7_tf);
  snprintf(l, sizeof(l), "NFC  b#%lu", (unsigned long)g_bootCount);
  oled.drawStr(0, 7, l);
  snprintf(l, sizeof(l), "EN:%s c%u", espnowReady ? "RDY" : "OFF", (unsigned)ESPNOW_CHANNEL);
  oled.drawStr(0, 15, l);
  snprintf(l, sizeof(l), "up%lus h%luk", (unsigned long)up, (unsigned long)heapK);
  oled.drawStr(0, 23, l);
  snprintf(l, sizeof(l), "C:%s", g_lastCmd.c_str());
  oled.drawStr(0, 31, l);
  snprintf(l, sizeof(l), "R:%s", g_lastResult.c_str());
  oled.drawStr(0, 39, l);
  oled.sendBuffer();
}

static void espNowBegin() {
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  esp_wifi_set_channel(ESPNOW_CHANNEL, WIFI_SECOND_CHAN_NONE);

  if (esp_now_init() != ESP_OK) {
    Serial.println("[ESPNOW] init failed");
    return;
  }

  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, ESPNOW_BROADCAST_MAC, sizeof(ESPNOW_BROADCAST_MAC));
  peer.channel = ESPNOW_CHANNEL;
  peer.encrypt = false;
  peer.ifidx = WIFI_IF_STA;

  if (!esp_now_is_peer_exist(ESPNOW_BROADCAST_MAC) && esp_now_add_peer(&peer) != ESP_OK) {
    Serial.println("[ESPNOW] broadcast peer failed");
    return;
  }

  espnowReady = true;
  Serial.printf("[ESPNOW] ready channel=%u mac=%s\n", ESPNOW_CHANNEL, WiFi.macAddress().c_str());
}

static bool sendRgbCommand(RgbCommand command) {
  if (!espnowReady) return false;

  RgbPacket packet = {
      RGB_PACKET_MAGIC_0,
      RGB_PACKET_MAGIC_1,
      RGB_PACKET_VERSION,
      (uint8_t)command,
  };
  return esp_now_send(ESPNOW_BROADCAST_MAC, (const uint8_t*)&packet, sizeof(packet)) == ESP_OK;
}

static void pollWebRgbButtonEvents() {
  // Web integration placeholder:
  // call sendRgbCommand(RGB_CMD_R/G/B) when the admin R/G/B button event is received.
}

static void nfcBegin() {
  pinMode(PIN_NFC_NSS, OUTPUT);
  digitalWrite(PIN_NFC_NSS, HIGH);
  pinMode(PIN_NFC_RST, OUTPUT);
  digitalWrite(PIN_NFC_RST, HIGH);
  pinMode(PIN_NFC_BUSY, INPUT);

  SPI.begin(PIN_NFC_SCK, PIN_NFC_MISO, PIN_NFC_MOSI, PIN_NFC_NSS);
  digitalWrite(PIN_NFC_RST, LOW);
  delay(10);
  digitalWrite(PIN_NFC_RST, HIGH);
  delay(50);
}

static bool nfcWaitBusyLevel(uint8_t level, uint16_t timeoutMs) {
  uint32_t start = millis();
  while (digitalRead(PIN_NFC_BUSY) != level) {
    if (millis() - start > timeoutMs) return false;
    delay(1);
  }
  return true;
}

static bool pn5180SendBytes(const uint8_t* data, size_t len) {
  if (!nfcWaitBusyLevel(LOW, NFC_TIMEOUT_MS)) return false;

  digitalWrite(PIN_NFC_NSS, LOW);
  delay(5);
  SPI.beginTransaction(nfcSpiSettings);
  for (size_t i = 0; i < len; i++) {
    SPI.transfer(data[i]);
  }

  if (!nfcWaitBusyLevel(HIGH, NFC_TIMEOUT_MS)) {
    SPI.endTransaction();
    digitalWrite(PIN_NFC_NSS, HIGH);
    return false;
  }
  SPI.endTransaction();
  digitalWrite(PIN_NFC_NSS, HIGH);
  delay(5);
  return nfcWaitBusyLevel(LOW, NFC_TIMEOUT_MS);
}

static bool pn5180ReadBytes(uint8_t* data, size_t len) {
  if (!nfcWaitBusyLevel(LOW, NFC_TIMEOUT_MS)) return false;

  digitalWrite(PIN_NFC_NSS, LOW);
  delay(5);
  SPI.beginTransaction(nfcSpiSettings);
  for (size_t i = 0; i < len; i++) {
    data[i] = SPI.transfer(0x00);
  }

  if (!nfcWaitBusyLevel(HIGH, NFC_TIMEOUT_MS)) {
    SPI.endTransaction();
    digitalWrite(PIN_NFC_NSS, HIGH);
    return false;
  }
  SPI.endTransaction();
  digitalWrite(PIN_NFC_NSS, HIGH);
  delay(5);
  return nfcWaitBusyLevel(LOW, NFC_TIMEOUT_MS);
}

static bool pn5180WriteRegister(uint8_t reg, uint32_t value) {
  uint8_t cmd[] = {
      PN5180_WRITE_REGISTER,
      reg,
      (uint8_t)(value & 0xFF),
      (uint8_t)((value >> 8) & 0xFF),
      (uint8_t)((value >> 16) & 0xFF),
      (uint8_t)((value >> 24) & 0xFF),
  };
  return pn5180SendBytes(cmd, sizeof(cmd));
}

static bool pn5180WriteRegisterOrMask(uint8_t reg, uint32_t mask) {
  uint8_t cmd[] = {
      PN5180_WRITE_REGISTER_OR_MASK,
      reg,
      (uint8_t)(mask & 0xFF),
      (uint8_t)((mask >> 8) & 0xFF),
      (uint8_t)((mask >> 16) & 0xFF),
      (uint8_t)((mask >> 24) & 0xFF),
  };
  return pn5180SendBytes(cmd, sizeof(cmd));
}

static bool pn5180WriteRegisterAndMask(uint8_t reg, uint32_t mask) {
  uint8_t cmd[] = {
      PN5180_WRITE_REGISTER_AND_MASK,
      reg,
      (uint8_t)(mask & 0xFF),
      (uint8_t)((mask >> 8) & 0xFF),
      (uint8_t)((mask >> 16) & 0xFF),
      (uint8_t)((mask >> 24) & 0xFF),
  };
  return pn5180SendBytes(cmd, sizeof(cmd));
}

static bool pn5180ReadRegister(uint8_t reg, uint32_t* value) {
  uint8_t cmd[] = {PN5180_READ_REGISTER, reg};
  uint8_t raw[4] = {0};
  if (!pn5180SendBytes(cmd, sizeof(cmd))) return false;
  if (!pn5180ReadBytes(raw, sizeof(raw))) return false;
  *value = ((uint32_t)raw[0])
      | ((uint32_t)raw[1] << 8)
      | ((uint32_t)raw[2] << 16)
      | ((uint32_t)raw[3] << 24);
  return true;
}

static bool pn5180ClearIrq() {
  return pn5180WriteRegister(REG_IRQ_CLEAR, 0x000FFFFFUL);
}

static bool pn5180SetIdle() {
  return pn5180WriteRegisterAndMask(REG_SYSTEM_CONFIG, 0xFFFFFFF8UL);
}

static bool pn5180ActivateTransceive() {
  return pn5180WriteRegisterOrMask(REG_SYSTEM_CONFIG, 0x00000003UL);
}

static bool pn5180LoadIso15693Config() {
  uint8_t cmd[] = {PN5180_LOAD_RF_CONFIG, 0x0D, 0x8D};
  return pn5180SendBytes(cmd, sizeof(cmd));
}

static bool pn5180SetRf(bool enabled) {
  uint8_t cmd[] = {(uint8_t)(enabled ? PN5180_RF_ON : PN5180_RF_OFF), 0x00};
  uint32_t wantedIrq = enabled ? IRQ_TX_RF_ON : IRQ_TX_RF_OFF;
  pn5180ClearIrq();
  if (!pn5180SendBytes(cmd, sizeof(cmd))) return false;

  uint32_t start = millis();
  while (millis() - start <= NFC_TIMEOUT_MS) {
    uint32_t irq = 0;
    if (!pn5180ReadRegister(REG_IRQ_STATUS, &irq)) return false;
    if (irq & wantedIrq) {
      pn5180ClearIrq();
      return true;
    }
    delay(1);
  }
  return false;
}

static bool pn5180SendData(const uint8_t* frame, size_t frameLen) {
  if (frameLen > 32) return false;
  uint8_t cmd[34];
  cmd[0] = PN5180_SEND_DATA;
  cmd[1] = 0x00;
  memcpy(cmd + 2, frame, frameLen);
  return pn5180SendBytes(cmd, frameLen + 2);
}

static bool pn5180ReadData(uint8_t* response, uint16_t len) {
  uint8_t cmd[] = {PN5180_READ_DATA, 0x00};
  if (!pn5180SendBytes(cmd, sizeof(cmd))) return false;
  return pn5180ReadBytes(response, len);
}

static bool nfcTransceiveIso15693(
    const uint8_t* frame,
    size_t frameLen,
    uint8_t* response,
    uint16_t responseCapacity,
    uint16_t* responseLen) {
  *responseLen = 0;
  if (!pn5180ClearIrq()) return false;
  if (!pn5180SetIdle()) return false;
  if (!pn5180ActivateTransceive()) return false;
  if (!pn5180SendData(frame, frameLen)) return false;

  uint32_t start = millis();
  while (millis() - start <= NFC_TIMEOUT_MS) {
    uint32_t irq = 0;
    if (!pn5180ReadRegister(REG_IRQ_STATUS, &irq)) return false;
    if (irq & (IRQ_RX | IRQ_IDLE)) {
      uint32_t rxStatus = 0;
      if (!pn5180ReadRegister(REG_RX_STATUS, &rxStatus)) return false;
      uint16_t len = (uint16_t)(rxStatus & 0x01FF);
      if (len == 0 || len > responseCapacity) {
        pn5180ClearIrq();
        return false;
      }
      if (!pn5180ReadData(response, len)) return false;
      *responseLen = len;
      pn5180ClearIrq();
      return true;
    }
    delay(1);
  }
  return false;
}

static bool nfcInventory(uint8_t uid[8]) {
  uint8_t frame[] = {
      ISO15693_FLAGS_INVENTORY_1_SLOT,
      ISO15693_CMD_INVENTORY,
      0x00,
  };
  uint8_t response[12] = {0};
  uint16_t responseLen = 0;
  if (!nfcTransceiveIso15693(frame, sizeof(frame), response, sizeof(response), &responseLen)) {
    return false;
  }
  if (responseLen < 10 || (response[0] & 0x01)) return false;
  memcpy(uid, response + 2, 8);
  return true;
}

static bool nfcWriteSingleBlock(
    const uint8_t uid[8],
    uint8_t block,
    const uint8_t payload[NFC_BLOCK_BYTES]) {
  uint8_t frame[2 + 8 + 1 + NFC_BLOCK_BYTES];
  frame[0] = ISO15693_FLAGS_ADDRESSED;
  frame[1] = ISO15693_CMD_WRITE_SINGLE_BLOCK;
  memcpy(frame + 2, uid, 8);
  frame[10] = block;
  memcpy(frame + 11, payload, NFC_BLOCK_BYTES);

  uint8_t response[4] = {0};
  uint16_t responseLen = 0;
  if (!nfcTransceiveIso15693(frame, sizeof(frame), response, sizeof(response), &responseLen)) {
    return false;
  }
  return responseLen >= 1 && !(response[0] & 0x01);
}

static bool nfcReadSingleBlock(
    const uint8_t uid[8],
    uint8_t block,
    uint8_t payload[NFC_BLOCK_BYTES]) {
  uint8_t frame[2 + 8 + 1];
  frame[0] = ISO15693_FLAGS_ADDRESSED;
  frame[1] = ISO15693_CMD_READ_SINGLE_BLOCK;
  memcpy(frame + 2, uid, 8);
  frame[10] = block;

  uint8_t response[8] = {0};
  uint16_t responseLen = 0;
  if (!nfcTransceiveIso15693(frame, sizeof(frame), response, sizeof(response), &responseLen)) {
    return false;
  }
  if (responseLen < 1 + NFC_BLOCK_BYTES || (response[0] & 0x01)) return false;
  memcpy(payload, response + 1, NFC_BLOCK_BYTES);
  return true;
}

static NfcResult nfcSessionBegin() {
  if (!pn5180LoadIso15693Config()) return NFC_RESULT_READER_FAILED;
  if (!pn5180SetRf(true)) return NFC_RESULT_RF_FAILED;
  return NFC_RESULT_OK;
}

static void nfcSessionEnd() {
  pn5180SetRf(false);
}

static NfcResult nfcInventorySession(uint8_t uid[8]) {
  NfcResult started = nfcSessionBegin();
  if (started != NFC_RESULT_OK) return started;
  bool found = nfcInventory(uid);
  nfcSessionEnd();
  return found ? NFC_RESULT_OK : NFC_RESULT_NO_TAG;
}

static NfcResult nfcWriteBlockWithVerify(const uint8_t payload[NFC_BLOCK_BYTES]) {
  uint8_t uid[8] = {0};
  uint8_t verify[NFC_BLOCK_BYTES] = {0};

  NfcResult started = nfcSessionBegin();
  if (started != NFC_RESULT_OK) return started;
  if (!nfcInventory(uid)) {
    nfcSessionEnd();
    return NFC_RESULT_NO_TAG;
  }
  if (!nfcWriteSingleBlock(uid, NFC_TRIGGER_BLOCK, payload)) {
    nfcSessionEnd();
    return NFC_RESULT_WRITE_FAILED;
  }

  delay(20);
  bool verified = nfcReadSingleBlock(uid, NFC_TRIGGER_BLOCK, verify);
  nfcSessionEnd();
  if (!verified || memcmp(verify, payload, NFC_BLOCK_BYTES) != 0) {
    return NFC_RESULT_VERIFY_FAILED;
  }
  return NFC_RESULT_OK;
}

static void printResult(NfcResult result, const char* writeFailure) {
  if (result == NFC_RESULT_OK) {
    Serial.println("OK"); setResult("OK");
  } else if (result == NFC_RESULT_READER_FAILED) {
    Serial.println("ERR NFC_READER_FAILED"); setResult("RDR_FAIL");
  } else if (result == NFC_RESULT_RF_FAILED) {
    Serial.println("ERR NFC_RF_FAILED"); setResult("RF_FAIL");
  } else if (result == NFC_RESULT_NO_TAG) {
    Serial.println("ERR NFC_NO_TAG"); setResult("NO_TAG");
  } else if (result == NFC_RESULT_VERIFY_FAILED) {
    Serial.printf("ERR %s_VERIFY\n", writeFailure); setResult("VERIFY");
  } else {
    Serial.printf("ERR %s\n", writeFailure); setResult("WR_FAIL");
  }
}

static void handleCommand(String cmd) {
  cmd.trim();
  cmd.toUpperCase();
  g_lastCmd = cmd;
  g_lastCmdAt = millis();
  if (cmd == "PING") {
    Serial.println("OK PONG"); setResult("PONG");
  } else if (cmd == "STATUS") {
    uint32_t irq = 0;
    uint32_t rx = 0;
    bool ok1 = pn5180ReadRegister(REG_IRQ_STATUS, &irq);
    bool ok2 = pn5180ReadRegister(REG_RX_STATUS, &rx);
    Serial.printf("OK BUSY=%d IRQ_OK=%d IRQ=0x%08lX RX_OK=%d RX=0x%08lX\n",
                  digitalRead(PIN_NFC_BUSY), ok1, irq, ok2, rx);
  } else if (cmd == "RFON") {
    printResult(nfcSessionBegin(), "NFC_RF_FAILED");
  } else if (cmd == "RFOFF") {
    Serial.println(pn5180SetRf(false) ? "OK" : "ERR NFC_RF_OFF_FAILED");
  } else if (cmd == "INVENTORY") {
    uint8_t uid[8] = {0};
    NfcResult result = nfcInventorySession(uid);
    if (result == NFC_RESULT_OK) {
      Serial.print("OK UID=");
      for (uint8_t i = 0; i < 8; i++) {
        Serial.printf("%02X", uid[i]);
      }
      Serial.println();
      setResult("UID OK");
    } else {
      printResult(result, "NFC_INVENTORY_FAILED");
    }
  } else if (cmd == "WAKE") {
    printResult(nfcWriteBlockWithVerify(NFC_WAKE_PAYLOAD), "NFC_WAKE_FAILED");
  } else if (cmd == "CLEAR") {
    printResult(nfcWriteBlockWithVerify(NFC_CLEAR_PAYLOAD), "NFC_CLEAR_FAILED");
  } else if (cmd == "PASS") {
    Serial.println("OK passed");
  } else if (cmd == "DENY") {
    Serial.println("OK");
  } else if (cmd == "RGB R" || cmd == "LED R" || cmd == "R") {
    bool ok = sendRgbCommand(RGB_CMD_R);
    Serial.println(ok ? "OK RGB=R" : "ERR ESPNOW_SEND_FAILED");
    setResult(ok ? "TX R OK" : "TX FAIL");
  } else if (cmd == "RGB G" || cmd == "LED G" || cmd == "G") {
    bool ok = sendRgbCommand(RGB_CMD_G);
    Serial.println(ok ? "OK RGB=G" : "ERR ESPNOW_SEND_FAILED");
    setResult(ok ? "TX G OK" : "TX FAIL");
  } else if (cmd == "RGB B" || cmd == "LED B" || cmd == "B") {
    bool ok = sendRgbCommand(RGB_CMD_B);
    Serial.println(ok ? "OK RGB=B" : "ERR ESPNOW_SEND_FAILED");
    setResult(ok ? "TX B OK" : "TX FAIL");
  } else if (cmd == "RGB OFF" || cmd == "LED OFF" || cmd == "OFF") {
    bool ok = sendRgbCommand(RGB_CMD_OFF);
    Serial.println(ok ? "OK RGB=OFF" : "ERR ESPNOW_SEND_FAILED");
    setResult(ok ? "TX OFF OK" : "TX FAIL");
  } else {
    Serial.printf("ERR UNKNOWN %s\n", cmd.c_str());
    setResult("UNKNOWN");
  }
  drawDebug();   // 명령 처리 후 OLED 갱신
}

void setup() {
  Serial.begin(115200);
  delay(300);
  g_bootCount++;                       // 리셋/크래시마다 증가 — OLED 에서 확인
  Wire.begin(OLED_SDA, OLED_SCL);
  oled.begin();
  oled.setFont(u8g2_font_5x7_tf);
  drawDebug();                         // 부팅 직후 1차 표시 (EN:OFF)
  nfcBegin();
  espNowBegin();
  serialBuf.reserve(64);
  Serial.println("READY ESP32_PN5180_SMOKE");
  drawDebug();                         // ESP-NOW 초기화 결과 반영
}

void loop() {
  pollWebRgbButtonEvents();

  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    if (c == '\r') continue;
    if (c == '\n') {
      if (serialBuf.length() > 0) handleCommand(serialBuf);
      serialBuf = "";
    } else if (serialBuf.length() < 64) {
      serialBuf += c;
    }
  }

  // 주기 갱신 — 가동시간/heap 이 계속 올라가면 정상, 0 으로 떨어지면 리셋된 것.
  static uint32_t lastDraw = 0;
  if (millis() - lastDraw > 1000) {
    lastDraw = millis();
    drawDebug();
  }

  delay(5);
}
