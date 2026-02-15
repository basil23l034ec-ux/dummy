# Smart Trolley — Programming Languages (Percentage)

This document lists the programming languages used in the Smart Trolley project and their share by line count (percentage of total source code).

---

## Scope

Counts include **project source only**:

- `backend/` (Python)
- `customer-frontend/` (HTML, JavaScript, CSS)
- `admin-frontend/` (HTML, JavaScript)
- `worker-frontend/` (HTML, JavaScript, CSS)
- `hardware/` (Arduino/C++)

Excluded: `.venv`, Android app, third-party libraries, generated files.

---

## Language breakdown

| Language         | Lines | Percentage | Where it's used |
|------------------|-------|------------|------------------|
| **HTML**         | 4,373 | **44.2%**  | All frontend templates: customer `index.html`, admin (logi, admin, inventory, settings, sales, reports, alerts, customers, trolleys), worker (login, worker). Structure and markup. |
| **Python**       | 2,387 | **24.1%**  | Backend: `app.py` (Flask routes, RFID, cart, checkout, admin/worker APIs, analytics, alerts, AI), `db.py` (SQLite, products, cart, sales, promotions). Config and verify/debug scripts. |
| **JavaScript**   | 2,367 | **23.9%**  | Customer `main.js` + `api.js`, admin `admin.js` + `api.js`, worker `worker.js`. UI logic, cart polling, promotions, API calls, dashboard, inventory, settings. |
| **CSS**          | 631   | **6.4%**   | Customer `style.css`, worker `worker.css`. Layout, themes, responsiveness. |
| **C++ (Arduino)** | 142   | **1.4%**   | Hardware: `hardware/esp8266_rfid.ino`. RFID read (MFRC522), WiFi, HTTP POST to Pi. |
| **Total**        | 9,900 | **100%**   | — |

---

## Summary

- **HTML** — Largest share; all web templates.
- **Python** — Backend server and database logic.
- **JavaScript** — Frontend behaviour (customer, admin, worker).
- **CSS** — Styling for customer and worker UIs.
- **C++ (Arduino)** — RFID firmware on the ESP8266 only.

---

## Visual (approximate)

```
HTML         ████████████████████████████████████████████  44.2%
Python       ██████████████████████████                    24.1%
JavaScript   █████████████████████████                     23.9%
CSS          ██████                                         6.4%
C++/Arduino  █                                               1.4%
```
