/*
 * arduino_uno.ino — 운영자 장치 통합 슬레이브 (gate + NFC).
 *
 * 노트북 파이썬 서버와 USB 시리얼(115200, 8N1)로 통신한다. 명령은 줄 단위 ASCII이며
 * 한 명령당 한 응답("OK ...", "ERR ...")을 보낸다.
 *
 * 통합 프로토콜 (ESP32-C3 팔찌 직결 펌웨어와 동일):
 *   WAKE   → OK           PN5180을 통해 ST25DV16K에 BLE_TRIGGER 기록 (팔찌 광고 깨움)
 *   PASS   → OK           서보 게이트 OPEN + 초음파 통과 감지 + 녹색 LED
 *   DENY   → OK           적색 LED 점등, 게이트 잠금 유지
 *   CLEAR  → OK           NFC 영역 초기화 (반납)
 *   PING   → OK PONG      헬스 체크
 *
 * 실제 PN5180 SPI 드라이버는 ELECHOUSE/playfultechnology 라이브러리 사용 권장.
 * 본 스케치는 시리얼 프로토콜 골격 + 게이트 시퀀스를 제공한다.
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
  if      (cmd == "PING")  Serial.println("OK PONG");
  else if (cmd == "WAKE")  cmdWake();
  else if (cmd == "PASS")  cmdPass();
  else if (cmd == "DENY")  cmdDeny();
  else if (cmd == "CLEAR") cmdClear();
  else {
    Serial.print("ERR UNKNOWN ");
    Serial.println(cmd);
  }
}

// WAKE — PN5180으로 ST25DV16K EEPROM에 BLE 연결 정보 기록 → 팔찌가 BLE 광고 시작
void cmdWake() {
  // TODO: PN5180 SPI write 구현
  delay(150);
  Serial.println("OK");
}

// PASS — 게이트 OPEN + 초음파 통과 감지. 통과 여부와 무관하게 OK 응답 (서버는 OK만 확인).
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

  // 통과 감지 정보는 디버그 토큰으로만 부착. 서버 코드는 prefix "OK"만 검사한다.
  if (passed) Serial.println("OK passed");
  else        Serial.println("OK timeout");
}

void cmdDeny() {
  digitalWrite(PIN_LED_RED, HIGH);
  digitalWrite(PIN_LED_GREEN, LOW);
  delay(800);
  digitalWrite(PIN_LED_RED, LOW);
  Serial.println("OK");
}

// CLEAR — NFC 영역 0x00 기록 (반납)
void cmdClear() {
  // TODO: PN5180 SPI 영역 초기화 구현
  delay(150);
  Serial.println("OK");
}

float readUltrasonicCm() {
  digitalWrite(PIN_ULTRA_TRIG, LOW);  delayMicroseconds(2);
  digitalWrite(PIN_ULTRA_TRIG, HIGH); delayMicroseconds(10);
  digitalWrite(PIN_ULTRA_TRIG, LOW);
  unsigned long us = pulseIn(PIN_ULTRA_ECHO, HIGH, 30000UL);
  if (us == 0) return -1.0;
  return (us * 0.0343f) / 2.0f;
}
