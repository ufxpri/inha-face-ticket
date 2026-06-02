// ESP32-C3 + ST25DV16K I2C smoke test.
//
// Default wiring:
//   ST25DV16K VCC -> ESP32-C3 3.3V
//   ST25DV16K GND -> ESP32-C3 GND
//   ST25DV16K SDA -> GPIO5
//   ST25DV16K SCL -> GPIO6
//
// Serial commands:
//   PING, SCAN, READ8, WAKE, CLEAR

#include <Arduino.h>
#include <Wire.h>

static const uint8_t PIN_I2C_SDA = 5;
static const uint8_t PIN_I2C_SCL = 6;
static const uint8_t ST25_USER_ADDR = 0x53;
static const uint8_t ST25_SYSTEM_ADDR = 0x57;
static const uint8_t ST25_DYNAMIC_ADDR = 0x2D;
static const uint8_t NFC_TRIGGER_BLOCK = 8;
static const uint8_t NFC_BLOCK_BYTES = 4;
static const uint16_t NFC_TRIGGER_BYTE_ADDR = NFC_TRIGGER_BLOCK * NFC_BLOCK_BYTES;
static const uint8_t NFC_WAKE_PAYLOAD[NFC_BLOCK_BYTES] = {'F', 'T', 'W', 'K'};
static const uint8_t NFC_CLEAR_PAYLOAD[NFC_BLOCK_BYTES] = {0x00, 0x00, 0x00, 0x00};

static String serialBuf;

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
  } else {
    Serial.printf("ERR UNKNOWN %s\n", cmd.c_str());
  }
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  Wire.setClock(100000);
  serialBuf.reserve(64);
  Serial.println("READY ST25DV16K_I2C_SMOKE");
}

void loop() {
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
