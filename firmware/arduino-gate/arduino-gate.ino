/*
 * arduino-gate.ino - operator device sketch for FaceTicket.
 *
 * The server talks to this board over USB serial (115200, 8N1). Commands are
 * ASCII lines and each command returns exactly one response line.
 *
 * This UNO sketch owns the physical gate only. NFC WAKE/CLEAR are deliberately
 * left as fail-closed placeholders because PN5180 inputs need 3.3 V logic.
 * Use the ESP32-C3 + PN5180 firmware for NFC writer tests without a level
 * shifter.
 */

#include <Servo.h>

const uint8_t PIN_SERVO = 9;
const uint8_t PIN_LED_GREEN = 5;
const uint8_t PIN_LED_RED = 6;
const uint8_t PIN_ULTRA_TRIG = 7;
const uint8_t PIN_ULTRA_ECHO = 8;

const uint8_t SERVO_CLOSED_DEG = 0;
const uint8_t SERVO_OPEN_DEG = 90;
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
  buf.reserve(32);
  Serial.println("READY");
}

void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      if (buf.length() > 0) handleCommand(buf);
      buf = "";
    } else if (buf.length() < 32) {
      buf += c;
    }
  }
}

void handleCommand(const String& cmd) {
  if (cmd == "PING") {
    Serial.println("OK PONG");
  } else if (cmd == "WAKE") {
    cmdWake();
  } else if (cmd == "PASS") {
    cmdPass();
  } else if (cmd == "DENY") {
    cmdDeny();
  } else if (cmd == "CLEAR") {
    cmdClear();
  } else {
    Serial.print("ERR UNKNOWN ");
    Serial.println(cmd);
  }
}

void cmdWake() {
  delay(150);
  Serial.println("ERR NFC_WAKE_NOT_IMPLEMENTED");
}

void cmdPass() {
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

  if (passed) {
    Serial.println("OK passed");
  } else {
    Serial.println("OK timeout");
  }
}

void cmdDeny() {
  digitalWrite(PIN_LED_RED, HIGH);
  digitalWrite(PIN_LED_GREEN, LOW);
  delay(800);
  digitalWrite(PIN_LED_RED, LOW);
  Serial.println("OK");
}

void cmdClear() {
  delay(150);
  Serial.println("ERR NFC_CLEAR_NOT_IMPLEMENTED");
}

float readUltrasonicCm() {
  digitalWrite(PIN_ULTRA_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_ULTRA_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_ULTRA_TRIG, LOW);
  unsigned long us = pulseIn(PIN_ULTRA_ECHO, HIGH, 30000UL);
  if (us == 0) return -1.0;
  return (us * 0.0343f) / 2.0f;
}
