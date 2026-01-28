#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <SPI.h>
#include <MFRC522.h>

// --------------------------------------------------------------------------------
//  CONFIGURATION
// --------------------------------------------------------------------------------

// 1. Wi-Fi Credentials
const char* ssid     = "YOUR_WIFI_SSID";     // <--- CHANGE THIS
const char* password = "YOUR_WIFI_PASSWORD"; // <--- CHANGE THIS

// 2. Raspberry Pi Server Address
// User provided IP: 10.42.0.1
const String serverUrl = "http://10.42.0.1:5000/rfid"; 

// 3. RFID Pin Layout (ESP8266 / NodeMCU)
#define RST_PIN  D3  // GPIO 0
#define SS_PIN   D4  // GPIO 2

// --------------------------------------------------------------------------------

MFRC522 rfid(SS_PIN, RST_PIN); // Instance of the class
String oldUidString = "";
unsigned long lastScanTime = 0;

void setup() {
  Serial.begin(115200);
  
  // Init SPI bus and RFID
  SPI.begin(); 
  rfid.PCD_Init(); 

  // Connect to Wi-Fi
  WiFi.begin(ssid, password);
  Serial.println("\nConnecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected to WiFi!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  Serial.println("Ready to scan RFID tags...");
}

void loop() {
  // 1. Check if a new card is present
  if (!rfid.PICC_IsNewCardPresent()) return;
  if (!rfid.PICC_ReadCardSerial()) return;

  // 2. Read UID
  String uidString = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uidString += "0";
    uidString += String(rfid.uid.uidByte[i], HEX);
  }
  uidString.toUpperCase();

  // Debounce: Don't read the same card multiple times instantly
  if (uidString == oldUidString && millis() - lastScanTime < 2000) {
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    return;
  }
  
  lastScanTime = millis();
  oldUidString = uidString;

  Serial.print("Scanned UID: ");
  Serial.println(uidString);

  // 3. Send to Server
  if (WiFi.status() == WL_CONNECTED) {
    WiFiClient client;
    HTTPClient http;

    Serial.print("Sending to: ");
    Serial.println(serverUrl);
    
    http.begin(client, serverUrl);
    http.addHeader("Content-Type", "application/json");

    // Create JSON payload: {"uid": "YOUR_UID"}
    String jsonPayload = "{\"uid\": \"" + uidString + "\"}";
    
    int httpResponseCode = http.POST(jsonPayload);

    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.print("Server Response Code: ");
      Serial.println(httpResponseCode);
      Serial.println("Response: " + response);
    } else {
      Serial.print("Error on sending POST: ");
      Serial.println(httpResponseCode);
    }

    http.end();
  } else {
    Serial.println("WiFi Disconnected");
  }

  // Halt PICC
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}
