/*
 * arduino_uno.ino — 발급/입장 장치의 시리얼 슬레이브
 *
 * 노트북 파이썬 서버와 USB 시리얼(115200, 8N1)로 통신한다.
 * 명령은 줄 단위 ASCII이며 한 명령당 한 응답("OK ...", "ERR ...")을 보낸다.
 *
 * 지원 명령:
 *   NFC_WRITE BLE_TRIGGER   — PN5180을 통해 ST25DV16K EEPROM에 BLE 연결 정보를 기록
 *   NFC_CLEAR               — NFC 영역 초기화 (반납)
 *   GATE OPEN               — 서보로 게이트 개방 후 초음파 통과 감지 (입장)
 *                              응답: OK PASS / OK TIMEOUT / ERR ...
 *   GATE DENY               — 적색 LED 점등, 게이트 닫힘 유지
 *   PING                    — 헬스 체크
 *
 * 실제 PN5180 SPI 드라이버는 ELECHOUSE/playfultechnology 라이브러리 사용을 권장.
 * 본 스케치는 시리얼 프로토콜 골격을 제공한다.
 */

#include <Servo.h>

const uint8_t PIN_SERVO       = 9;
const uint8_t PIN_LED_GREEN   = 5;
const uint8_t PIN_LED_RED     = 6;
const uint8_t PIN_ULTRA_TRIG  = 7;
const uint8_t PIN_ULTRA_ECHO  = 8;

const uint8_t SERVO_CLOSED_DEG = 0;
const uint8_t SERVO_OPEN_DEG   = 90;
const unsigned long PASS_TIMEOUT_MS = 5000;
const float PASS_DISTANCE_CM = 25.0;

Servo gateServo;
String buf;

void setup() {
  Serial.begin(115200);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_ULTRA_TRIG, OUTPUT);
  pinMode(PIN_ULTRA_ECHO, INPUT);
  gateServo.attach(PIN_SERVO);
  gateServo.write(SERVO_CLOSED_DEG);
  buf.reserve(64);
  Serial.println("READY");
}

void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      if (buf.length() > 0) handleCommand(buf);
      buf = "";
    } else if (buf.length() < 64) {
      buf += c;
    }
  }
}

void handleCommand(const String& cmd) {
  if (cmd == "PING") {
    Serial.println("OK PONG");
  } else if (cmd.startsWith("NFC_WRITE")) {
    // TODO: PN5180으로 ST25DV16K EEPROM에 BLE 연결 정보 기록
    delay(150);
    Serial.println("OK");
  } else if (cmd == "NFC_CLEAR") {
    // TODO: PN5180으로 NFC 영역 0x00 기록
    delay(150);
    Serial.println("OK");
  } else if (cmd == "GATE OPEN") {
    gateOpenSequence();
  } else if (cmd == "GATE DENY") {
    digitalWrite(PIN_LED_RED, HIGH);
    digitalWrite(PIN_LED_GREEN, LOW);
    delay(800);
    digitalWrite(PIN_LED_RED, LOW);
    Serial.println("OK");
  } else {
    Serial.print("ERR UNKNOWN ");
    Serial.println(cmd);
  }
}

void gateOpenSequence() {
  digitalWrite(PIN_LED_GREEN, HIGH);
  digitalWrite(PIN_LED_RED, LOW);
  gateServo.write(SERVO_OPEN_DEG);

  unsigned long start = millis();
  bool passed = false;
  while (millis() - start < PASS_TIMEOUT_MS) {
    float dist = readUltrasonicCm();
    if (dist > 0 && dist < PASS_DISTANCE_CM) {
      passed = true;
      break;
    }
    delay(40);
  }

  delay(500);
  gateServo.write(SERVO_CLOSED_DEG);
  digitalWrite(PIN_LED_GREEN, LOW);

  if (passed) Serial.println("OK PASS");
  else        Serial.println("OK TIMEOUT");
}

float readUltrasonicCm() {
  digitalWrite(PIN_ULTRA_TRIG, LOW);  delayMicroseconds(2);
  digitalWrite(PIN_ULTRA_TRIG, HIGH); delayMicroseconds(10);
  digitalWrite(PIN_ULTRA_TRIG, LOW);
  unsigned long us = pulseIn(PIN_ULTRA_ECHO, HIGH, 30000UL);
  if (us == 0) return -1.0;
  return (us * 0.0343f) / 2.0f;
}
