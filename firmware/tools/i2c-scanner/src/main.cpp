// I2C 스캐너 — GPIO5/6 과 GPIO8/9 양쪽 시도
// LED(GPIO8 또는 GPIO10)로 결과 표시:
//   - 1번 길게 깜빡 + N번 짧게 깜빡 = 5/6 핀에서 N개 장치 발견
//   - 2번 길게 깜빡 + N번 짧게 깜빡 = 8/9 핀에서 N개 장치 발견
//   - 시리얼이 잡히면 자세한 주소 정보도 출력
//
// 주의: 8/9 가 LED/BOOT 와 같은 핀이면 깜빡임이 이상할 수 있음 — 시리얼 우선

#include <Arduino.h>
#include <Wire.h>

#define LED_GUESS_A 8    // 통상 LED
#define LED_GUESS_B 10   // 일부 변종

static void blinkLong(int n, int ledPin) {
  for (int i = 0; i < n; i++) {
    digitalWrite(ledPin, LOW);   // active-low ON
    delay(600);
    digitalWrite(ledPin, HIGH);
    delay(300);
  }
  delay(500);
}

static void blinkShort(int n, int ledPin) {
  for (int i = 0; i < n; i++) {
    digitalWrite(ledPin, LOW);
    delay(120);
    digitalWrite(ledPin, HIGH);
    delay(180);
  }
  delay(800);
}

static int scanPair(int sda, int scl, const char* label) {
  Wire.end();
  delay(50);
  Wire.begin(sda, scl);
  Wire.setClock(100000);
  delay(50);
  Serial.printf("\n[SCAN] %s (SDA=%d, SCL=%d)\n", label, sda, scl);
  int found = 0;
  for (uint8_t a = 1; a < 127; a++) {
    Wire.beginTransmission(a);
    if (Wire.endTransmission() == 0) {
      Serial.printf("  device at 0x%02X\n", a);
      found++;
    }
  }
  Serial.printf("  total: %d\n", found);
  return found;
}

void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(LED_GUESS_A, OUTPUT);
  pinMode(LED_GUESS_B, OUTPUT);
  digitalWrite(LED_GUESS_A, HIGH);
  digitalWrite(LED_GUESS_B, HIGH);

  Serial.println("\n=== ESP32-C3 I2C Scanner ===");

  int n56 = scanPair(5, 6, "Pair A");
  int n89 = scanPair(8, 9, "Pair B");
  int n07 = scanPair(0, 1, "Pair C (just in case)");

  Serial.printf("\n[RESULT] 5/6=%d  8/9=%d  0/1=%d\n", n56, n89, n07);
  if (n56 == 0 && n89 == 0 && n07 == 0) {
    Serial.println("[!] 어떤 핀에서도 I2C 장치 없음 — OLED 하드웨어 의심");
  }

  // LED 결과 표시 (LED_GUESS_A 우선)
  int led = LED_GUESS_A;
  if (n56 > 0) {
    blinkLong(1, led);
    blinkShort(n56, led);
  }
  if (n89 > 0) {
    blinkLong(2, led);
    blinkShort(n89, led);
  }
  if (n07 > 0) {
    blinkLong(3, led);
    blinkShort(n07, led);
  }
  if (n56 == 0 && n89 == 0 && n07 == 0) {
    // 빠르게 계속 깜빡 (에러 표시)
    for (int i = 0; i < 20; i++) {
      digitalWrite(led, LOW);  delay(80);
      digitalWrite(led, HIGH); delay(80);
    }
  }
}

void loop() {
  // 5초 후 결과 재방송
  delay(5000);
  Serial.println("\n[리포트 재출력]");
  scanPair(5, 6, "Pair A");
  scanPair(8, 9, "Pair B");
}
