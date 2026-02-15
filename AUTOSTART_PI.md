# Smart Trolley — Auto-Start on Raspberry Pi Reboot

This guide explains how to make the Smart Trolley backend (and thus the customer-frontend) start automatically when the Raspberry Pi boots, and optionally open the customer UI in a browser (kiosk mode).

---

## 1. What auto-starts

- **Flask backend** (`backend/app.py`) — serves the customer-frontend, admin, worker, and RFID API.
- **Customer frontend** is then available at `http://<Pi-IP>:5000/` or `http://<Pi-IP>:5000/customer-frontend/`.

The backend is run as a **systemd service** so it starts after the network is up and restarts if it crashes.

---

## 2. Create the systemd service

On the Pi, create the service file (use `sudo`):

```bash
sudo nano /etc/systemd/system/smart-trolley.service
```

Paste the following. Replace `YOUR_USER` with your Pi username (e.g. `pi`) and adjust the path if the project is not in `/home/pi/smart-trolley`:

```ini
[Unit]
Description=Smart Trolley Flask Backend (serves customer-frontend)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=YOUR_USER
Group=YOUR_USER
WorkingDirectory=/home/YOUR_USER/smart-trolley
Environment="PATH=/home/YOUR_USER/smart-trolley/.venv/bin"
ExecStart=/home/YOUR_USER/smart-trolley/.venv/bin/python -u backend/app.py
Restart=on-failure
RestartSec=2

[Install]
WantedBy=multi-user.target
```

Save and exit (in nano: Ctrl+O, Enter, Ctrl+X).

---

## 3. Enable and start the service

Run on the Pi:

```bash
sudo systemctl daemon-reload
sudo systemctl enable smart-trolley.service
sudo systemctl start smart-trolley.service
sudo systemctl status smart-trolley.service
```

- **enable**: starts the service on every boot.
- **start**: starts it now.
- **status**: check that it is active. After a reboot, the customer-frontend will be available as soon as the service is up (typically within a few seconds of network being ready).

---

## 4. Useful commands

| Command | Purpose |
|--------|--------|
| `sudo systemctl status smart-trolley` | Check if the service is running |
| `sudo systemctl stop smart-trolley` | Stop the backend |
| `sudo systemctl start smart-trolley` | Start the backend |
| `sudo journalctl -u smart-trolley -f` | View live logs |
| `sudo journalctl -u smart-trolley -b` | View logs since last boot |

---

## 5. Optional: open customer-frontend in a browser on the Pi (kiosk)

If the Pi has a desktop and you want a browser to open the customer UI automatically after login:

1. Create an autostart entry:

   ```bash
   mkdir -p ~/.config/autostart
   nano ~/.config/autostart/smart-trolley-kiosk.desktop
   ```

2. Paste (adjust URL if needed):

   ```ini
   [Desktop Entry]
   Type=Application
   Name=Smart Trolley Kiosk
   Exec=chromium-browser --kiosk --noerrdialogs --disable-infobars http://127.0.0.1:5000/
   X-GNOME-Autostart-enabled=true
   ```

3. Save and exit. On next graphical login, Chromium will open in kiosk mode to the customer-frontend (assuming the backend is running via the systemd service).

---

## 6. Troubleshooting

- **Service fails to start:** Check logs with `sudo journalctl -u smart-trolley -n 50`. Ensure the project path and `.venv` exist and dependencies are installed (`pip install -r backend/requirements.txt` inside the venv).
- **Port 5000 in use:** Stop any other process using port 5000, or change `PORT` in `backend/config.py` and the kiosk URL.
- **Not reachable after reboot:** Ensure `After=network-online.target` is set and WiFi is connected; wait a few seconds after boot for the network to be ready.
