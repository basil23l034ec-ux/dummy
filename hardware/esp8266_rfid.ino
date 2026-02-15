#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>

/* ================== RFID PINS ================== */
#define SS_PIN  D4
#define RST_PIN D1

MFRC522 mfrc522(SS_PIN, RST_PIN);

/* ================== WIFI ================== */
const char* ssid = "X6";
const char* password = "12345678";

/* ================== SERVER ================== */
// AUTOMATIC IP UPDATE: Using the Pi's detected IP address
const String serverUrl = "http://10.128.199.147:5000/rfid";

/* ================== ANTI DUPLICATE ================== */
unsigned long lastReadTime = 0;
const unsigned long cooldown = 800;   // milliseconds

/* ================== SETUP ================== */
void setup() {

  Serial.begin(115200);
  delay(1000);

  /* RFID Init */
  SPI.begin();
  mfrc522.PCD_Init();
  delay(50);

  Serial.println("RFID Ready");

  /* WiFi Init */
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  Serial.print("Connecting WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi Connected");
  Serial.print("ESP IP: ");
  Serial.println(WiFi.localIP());
}

/* ================== LOOP ================== */
void loop() {

  /* Reconnect WiFi if dropped */
  if (WiFi.status() != WL_CONNECTED) {

    Serial.println("Reconnecting WiFi...");

    WiFi.disconnect();
    WiFi.begin(ssid, password);

    delay(2000);
    return;
  }

  /* Check for RFID card */
  if (!mfrc522.PICC_IsNewCardPresent()) return;
  if (!mfrc522.PICC_ReadCardSerial()) return;

  /* Cooldown check */
  unsigned long now = millis();

  if (now - lastReadTime < cooldown) {
    mfrc522.PICC_HaltA();
    return;
  }

  lastReadTime = now;

  /* Read UID */
  String uid = "";

  for (byte i = 0; i < mfrc522.uid.size; i++) {

    if (mfrc522.uid.uidByte[i] < 0x10)
      uid += "0";

    uid += String(mfrc522.uid.uidByte[i], HEX);
  }

  uid.toUpperCase();

  Serial.print("Card Detected: ");
  Serial.println(uid);

  /* Send UID to Pi */
  sendToPi(uid);

  /* Reset RFID */
  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();

  delay(300);   // stabilize reader
}

/* ================== SEND FUNCTION ================== */
void sendToPi(String uid) {

  WiFiClient client;
  HTTPClient http;

  if (!http.begin(client, serverUrl)) {
    Serial.println("HTTP Begin Failed");
    return;
  }

  http.addHeader("Content-Type", "application/json");

  String payload =
    "{\"uid\":\"" + uid + "\",\"trolley_id\":\"T01\"}";

  int httpCode = http.POST(payload);

  Serial.print("HTTP Code: ");
  Serial.println(httpCode);

  if (httpCode > 0) {

    String response = http.getString();

    Serial.print("Server Reply: ");
    Serial.println(response);

  } else {

    Serial.println("HTTP Send Failed");
  }

  http.end();
}
