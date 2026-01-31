#include <ESP8266HTTPClient.h>
#include <ESP8266WiFi.h>
#include <MFRC522.h>
#include <SPI.h>
#include <WiFiClient.h>


/*
 * -----------------------------------------------------------------------------------------
 *             MFRC522      Arduino       NodeMCU (ESP8266)
 *             Reader/PCD   Uno/101       Pinout
 * Signal      Pin          Pin           Pin
 * -----------------------------------------------------------------------------------------
 * RST/Reset   RST          9             D3 (GPIO0)
 * SPI SS      SDA(SS)      10            D4 (GPIO2)
 * SPI MOSI    MOSI         11 / ICSP-4   D7 (GPIO13)
 * SPI MISO    MISO         12 / ICSP-1   D6 (GPIO12)
 * SPI SCK     SCK          13 / ICSP-3   D5 (GPIO14)
 */

#define RST_PIN D3 // Configurable, see typical pin layout above
#define SS_PIN D4  // Configurable, see typical pin layout above

MFRC522 mfrc522(SS_PIN, RST_PIN); // Create MFRC522 instance

// ======================= CONFIGURATION =======================
const char *ssid = "YOUR_WIFI_SSID";
const char *password = "YOUR_WIFI_PASSWORD";
String serverUrl = "http://192.168.1.X:5000/rfid"; // UPDATE THIS IP
// =============================================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  // Init SPI bus
  SPI.begin();
  // Init MFRC522
  mfrc522.PCD_Init();

  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
  Serial.println("Ready to scan RFID tags...");
}

void loop() {
  // Look for new cards
  if (!mfrc522.PICC_IsNewCardPresent()) {
    return;
  }

  // Select one of the cards
  if (!mfrc522.PICC_ReadCardSerial()) {
    return;
  }

  // Show UID on serial monitor
  Serial.print("UID tag :");
  String content = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    Serial.print(mfrc522.uid.uidByte[i] < 0x10 ? " 0" : " ");
    Serial.print(mfrc522.uid.uidByte[i], HEX);
    content.concat(String(mfrc522.uid.uidByte[i] < 0x10 ? " 0" : " "));
    content.concat(String(mfrc522.uid.uidByte[i], HEX));
  }
  Serial.println();
  content.toUpperCase();

  // Send to Server
  if (WiFi.status() == WL_CONNECTED) {
    WiFiClient client;
    HTTPClient http;

    Serial.print("[HTTP] begin...\n");
    if (http.begin(client, serverUrl)) { // HTTP
      http.addHeader("Content-Type", "application/json");

      // Clean UID string (remove spaces)
      String cleanUid = "";
      for (int i = 0; i < content.length(); i++) {
        if (content[i] != ' ')
          cleanUid += content[i];
      }

      String payload = "{\"uid\": \"" + cleanUid + "\"}";
      Serial.print("[HTTP] POST payload: ");
      Serial.println(payload);

      int httpCode = http.POST(payload);

      if (httpCode > 0) {
        Serial.printf("[HTTP] POST... code: %d\n", httpCode);
        if (httpCode == HTTP_CODE_OK || httpCode == 201) {
          String payload = http.getString();
          Serial.println(payload);
        }
      } else {
        Serial.printf("[HTTP] POST... failed, error: %s\n",
                      http.errorToString(httpCode).c_str());
      }
      http.end();
    } else {
      Serial.printf("[HTTP} Unable to connect\n");
    }
  }

  // Halt PICC
  mfrc522.PICC_HaltA();
  // Stop encryption on PCD
  mfrc522.PCD_StopCrypto1();

  // Wait a bit before next scan
  delay(1000);
}
