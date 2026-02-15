# Smart Trolley — Setup and Deployment Guide

This guide explains how to set up and run the Smart Trolley system: backend on the Raspberry Pi, RFID hardware (ESP8266), and accessing the frontends.

---

## 1. Prerequisites

| Component | Requirement |
|-----------|-------------|
| **Raspberry Pi** | Running Raspberry Pi OS (or similar Linux), on the same WiFi as the ESP8266 |
| **Python** | 3.8+ (on the Pi) |
| **ESP8266** | NodeMCU or similar, with WiFi |
| **RFID** | MFRC522 reader, SPI wiring to ESP8266 |
| **Network** | Pi and ESP8266 on same LAN; Pi has a fixed or known IP for the ESP8266 to call |

---

## 2. Backend Setup (Raspberry Pi)

### 2.1 Clone or copy the project

Copy the `smart-trolley` project folder onto the Pi (e.g. to `/home/pi/smart-trolley`).

### 2.2 Create a virtual environment (recommended)

```bash
cd /home/pi/smart-trolley
python3 -m venv .venv
source .venv/bin/activate   # On Windows: .venv\Scripts\activate
```

### 2.3 Install dependencies

```bash
pip install -r backend/requirements.txt
```

Required packages: Flask, flask-cors, python-dotenv; optional for AI features: google-generativeai, groq, openai.

### 2.4 Environment variables (optional)

Create `backend/.env` if you need to override defaults or set API keys:

```env
# Optional: AI / design features (Groq or NVIDIA)
GENAI_API_KEY=your_key_here

# Optional: disable audit log
# DISABLE_AUDIT_LOG=1
```

### 2.5 Run the Flask app

```bash
cd backend
python app.py
```

Or use the config in `backend/config.py`: the app runs with `HOST='0.0.0.0'` and `PORT=5000`, so it is reachable from other devices on the LAN.

### 2.6 Find the Pi’s IP address

On the Pi:

```bash
hostname -I
```

Note the IP (e.g. `10.128.199.147`). The ESP8266 will use this for the `/rfid` URL.

---

## 3. RFID Hardware (ESP8266 + MFRC522)

### 3.1 Wiring (typical)

| MFRC522 | ESP8266 (NodeMCU) |
|---------|-------------------|
| SDA     | D4 (GPIO2)        |
| SCK     | D5 (GPIO14)       |
| MOSI    | D7 (GPIO13)       |
| MISO    | D6 (GPIO12)       |
| IRQ     | Not used          |
| GND     | GND               |
| RST     | D1 (GPIO5)        |
| 3.3V    | 3.3V              |

Pins are defined in `hardware/esp8266_rfid.ino` as `SS_PIN = D4`, `RST_PIN = D1`.

### 3.2 Configure WiFi and server URL

Edit `hardware/esp8266_rfid.ino`:

- **WiFi**: set `ssid` and `password` to your network.
- **Server**: set `serverUrl` to the Pi’s address and port, e.g.  
  `http://10.128.199.147:5000/rfid`

Example:

```cpp
const char* ssid     = "YourWiFiName";
const char* password = "YourWiFiPassword";
const String serverUrl = "http://10.128.199.147:5000/rfid";
```

### 3.3 Upload the sketch

- Install Arduino IDE (or PlatformIO).
- Install board support for **ESP8266** and the **MFRC522** library.
- Open `hardware/esp8266_rfid.ino`, select the correct board and port, then upload.

After upload, the ESP8266 will connect to WiFi and send each detected RFID UID to the Pi’s `/rfid` endpoint.

---

## 4. Accessing the Frontends

With the backend running on the Pi at `http://<PI_IP>:5000`:

| Frontend | URL |
|----------|-----|
| **Customer** (shopping cart) | `http://<PI_IP>:5000/customer-frontend/` or `/` (if routed) |
| **Admin** (dashboard, inventory, alerts) | `http://<PI_IP>:5000/admin/login` |
| **Worker** (scan products, add items) | `http://<PI_IP>:5000/worker/` (or worker login URL) |

Default admin login: `admin` / `admin123`. Default worker: `worker` / `worker123`. Change these in production (see `backend/app.py`).

---

## 5. Quick Checklist

- [ ] Backend dependencies installed (`pip install -r backend/requirements.txt`)
- [ ] Backend running on Pi (`python backend/app.py`), port 5000, HOST 0.0.0.0
- [ ] Pi IP known and stable (or update ESP8266 if it changes)
- [ ] ESP8266 sketch: WiFi and `serverUrl` set to Pi IP and `/rfid`
- [ ] MFRC522 wired and sketch uploaded
- [ ] Product UIDs in `backend/db.py` (DEFAULT_PRODUCTS) match tags you use
- [ ] Optional: `.env` with `GENAI_API_KEY` for AI design features

---

## 6. Related Documentation

- **AUTOSTART_PI.md** — Auto-start the backend (customer-frontend) when the Pi reboots
- **SYSTEM_DOCUMENTATION.md** — Architecture, RFID flow, algorithms, block diagrams
- **PROMOTION_SYSTEM.md** — Spin wheel and banner promotions behaviour
