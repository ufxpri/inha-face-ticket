// ESP32-C3 + ST25DV16K I2C smoke test.
//
// Default wiring:
//   ST25DV16K VCC -> ESP32-C3 3.3V
//   ST25DV16K GND -> ESP32-C3 GND
//   ST25DV16K SDA -> GPIO5
//   ST25DV16K SCL -> GPIO6
//   RGB LED B     -> GPIO0
//   RGB LED G     -> GPIO1
//   RGB LED R     -> GPIO2
//
// Serial commands:
//   PING, SCAN, READ8, WAKE, CLEAR, RGB R, RGB G, RGB B, RGB OFF

#include <Arduino.h>
#include <WiFi.h>
#include <esp_idf_version.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <Wire.h>

static const uint8_t PIN_I2C_SDA = 5;
static const uint8_t PIN_I2C_SCL = 6;
static const uint8_t PIN_RGB_B = 0;
static const uint8_t PIN_RGB_G = 1;
static const uint8_t PIN_RGB_R = 2;
static const uint8_t ST25_USER_ADDR = 0x53;
static const uint8_t ST25_SYSTEM_ADDR = 0x57;
static const uint8_t ST25_DYNAMIC_ADDR = 0x2D;
static const uint8_t NFC_TRIGGER_BLOCK = 8;
static const uint8_t NFC_BLOCK_BYTES = 4;
static const uint16_t NFC_TRIGGER_BYTE_ADDR = NFC_TRIGGER_BLOCK * NFC_BLOCK_BYTES;
static const uint8_t NFC_WAKE_PAYLOAD[NFC_BLOCK_BYTES] = {'F', 'T', 'W', 'K'};
static const uint8_t NFC_CLEAR_PAYLOAD[NFC_BLOCK_BYTES] = {0x00, 0x00, 0x00, 0x00};

static const uint8_t ESPNOW_CHANNEL = 6;
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

static String serialBuf;
static volatile bool pendingRgbCommand = false;
static volatile uint8_t pendingRgbValue = RGB_CMD_OFF;
static portMUX_TYPE rgbMux = portMUX_INITIALIZER_UNLOCKED;

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
  pendingRgbValue = command;
  pendingRgbCommand = true;
  portEXIT_CRITICAL(&rgbMux);
}

#if ESP_IDF_VERSION_MAJOR >= 5
static void onEspNowReceive(const esp_now_recv_info_t* recvInfo, const uint8_t* data, int len) {
  (void)recvInfo;
#else
static void onEspNowReceive(const uint8_t* mac, const uint8_t* data, int len) {
  (void)mac;
#endif
  uint8_t command = RGB_CMD_OFF;
  if (parseRgbPacket(data, len, &command)) {
    setPendingRgbCommand(command);
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

static void printHex4(const uint8_t data[NFC_BLOCK_BYTES]) {
  for (uint8_t i = 0; i < NFC_BLOCK_BYTES; i++) {
    Serial.printf("%02X", data[i]);
  }
}

static void cmdScan() {
  uint8_t count = 0;
  Serial.print("OK");
  for (uint8_t addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.printf(" 0x%02X", addr);
      count++;
    }
  }
  Serial.printf(" COUNT=%u USER=%d SYSTEM=%d DYNAMIC=%d\n",
                count,
                i2cPresent(ST25_USER_ADDR),
                i2cPresent(ST25_SYSTEM_ADDR),
                i2cPresent(ST25_DYNAMIC_ADDR));
}

static void cmdRead8() {
  uint8_t data[NFC_BLOCK_BYTES] = {0};
  if (!st25ReadBytes(NFC_TRIGGER_BYTE_ADDR, data, sizeof(data))) {
    Serial.println("ERR ST25_READ_FAILED");
    return;
  }
  Serial.print("OK BLOCK8=");
  printHex4(data);
  Serial.println();
}

static void cmdWriteBlock(const uint8_t payload[NFC_BLOCK_BYTES], const char* failCode) {
  if (!i2cPresent(ST25_USER_ADDR)) {
    Serial.println("ERR ST25_USER_NOT_FOUND");
    return;
  }
  if (!st25WriteBytes(NFC_TRIGGER_BYTE_ADDR, payload, NFC_BLOCK_BYTES)) {
    Serial.printf("ERR %s\n", failCode);
    return;
  }
  Serial.println("OK");
}

static void handleCommand(String cmd) {
  cmd.trim();
  cmd.toUpperCase();
  if (cmd == "PING") {
    Serial.println("OK PONG");
  } else if (cmd == "SCAN") {
    cmdScan();
  } else if (cmd == "READ8") {
    cmdRead8();
  } else if (cmd == "WAKE") {
    cmdWriteBlock(NFC_WAKE_PAYLOAD, "ST25_WAKE_FAILED");
  } else if (cmd == "CLEAR") {
    cmdWriteBlock(NFC_CLEAR_PAYLOAD, "ST25_CLEAR_FAILED");
  } else if (cmd == "RGB R" || cmd == "LED R" || cmd == "R") {
    applyRgbCommand(RGB_CMD_R);
    Serial.println("OK RGB=R");
  } else if (cmd == "RGB G" || cmd == "LED G" || cmd == "G") {
    applyRgbCommand(RGB_CMD_G);
    Serial.println("OK RGB=G");
  } else if (cmd == "RGB B" || cmd == "LED B" || cmd == "B") {
    applyRgbCommand(RGB_CMD_B);
    Serial.println("OK RGB=B");
  } else if (cmd == "RGB OFF" || cmd == "LED OFF" || cmd == "OFF") {
    applyRgbCommand(RGB_CMD_OFF);
    Serial.println("OK RGB=OFF");
  } else {
    Serial.printf("ERR UNKNOWN %s\n", cmd.c_str());
  }
}

void setup() {
  Serial.begin(115200);
  delay(300);
  pinMode(PIN_RGB_B, OUTPUT);
  pinMode(PIN_RGB_G, OUTPUT);
  pinMode(PIN_RGB_R, OUTPUT);
  applyRgbCommand(RGB_CMD_OFF);
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  Wire.setClock(100000);
  espNowBegin();
  serialBuf.reserve(64);
  Serial.println("READY ST25DV16K_I2C_SMOKE");
}

void loop() {
  bool hasRgbCommand = false;
  uint8_t rgbCommand = RGB_CMD_OFF;
  portENTER_CRITICAL(&rgbMux);
  if (pendingRgbCommand) {
    rgbCommand = pendingRgbValue;
    pendingRgbCommand = false;
    hasRgbCommand = true;
  }
  portEXIT_CRITICAL(&rgbMux);

  if (hasRgbCommand) {
    applyRgbCommand(rgbCommand);
    Serial.printf("OK ESPNOW RGB=%s\n", rgbCommandName(rgbCommand));
  }

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
  delay(5);
}
