# Setup Backend and Frontend as Systemd Services

## Prerequisites

1. **Python Virtual Environment** (for backend)
2. **Node.js and npm** installed
3. **Frontend built** (production build)

---

## Step 1: Prepare Backend

```bash
# Navigate to backend directory
cd /root/AK_Dialer/backend

# Create virtual environment (if not exists)
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Test backend runs
uvicorn app.main:app --host 0.0.0.0 --port 8000
# Press Ctrl+C to stop
```

---

## Step 2: Prepare Frontend

```bash
# Navigate to frontend directory
cd /root/AK_Dialer/frontend

# Install dependencies
npm install

# Build for production
npm run build

# Test frontend runs
npm start
# Press Ctrl+C to stop
```

---

## Step 3: Install Service Files

### Backend Service

```bash
# Copy service file to systemd directory
sudo cp dialer-backend.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable service (start on boot)
sudo systemctl enable dialer-backend

# Start service
sudo systemctl start dialer-backend

# Check status
sudo systemctl status dialer-backend
```

### Frontend Service

```bash
# Copy service file to systemd directory
sudo cp dialer-frontend.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable service (start on boot)
sudo systemctl enable dialer-frontend

# Start service
sudo systemctl start dialer-frontend

# Check status
sudo systemctl status dialer-frontend
```

---

## Step 4: Verify Services

```bash
# Check backend status
sudo systemctl status dialer-backend

# Check frontend status
sudo systemctl status dialer-frontend

# Check if ports are listening
sudo netstat -tlnp | grep -E "(8000|3000)"

# Test backend
curl http://localhost:8000/docs

# Test frontend
curl http://localhost:3000
```

---

## Useful Commands

### Backend Service

```bash
# Start
sudo systemctl start dialer-backend

# Stop
sudo systemctl stop dialer-backend

# Restart
sudo systemctl restart dialer-backend

# View logs
sudo journalctl -u dialer-backend -f

# View last 50 lines
sudo journalctl -u dialer-backend -n 50
```

### Frontend Service

```bash
# Start
sudo systemctl start dialer-frontend

# Stop
sudo systemctl stop dialer-frontend

# Restart
sudo systemctl restart dialer-frontend

# View logs
sudo journalctl -u dialer-frontend -f

# View last 50 lines
sudo journalctl -u dialer-frontend -n 50
```

---

## Troubleshooting

### Backend Not Starting

```bash
# Check logs
sudo journalctl -u dialer-backend -n 100

# Common issues:
# 1. Virtual environment path wrong - edit service file
# 2. Database not running - check PostgreSQL
# 3. Port 8000 already in use
# 4. Missing dependencies - check requirements.txt
```

### Frontend Not Starting

```bash
# Check logs
sudo journalctl -u dialer-frontend -n 100

# Common issues:
# 1. Not built - run `npm run build`
# 2. Port 3000 already in use
# 3. Missing node_modules - run `npm install`
# 4. Wrong working directory in service file
```

### Update Service Files

If you need to change paths or settings:

```bash
# Edit service file
sudo nano /etc/systemd/system/dialer-backend.service

# After editing, reload and restart
sudo systemctl daemon-reload
sudo systemctl restart dialer-backend
```

---

## Firewall Configuration

```bash
# Allow backend port
sudo ufw allow 8000/tcp

# Allow frontend port
sudo ufw allow 3000/tcp

# Check firewall status
sudo ufw status
```

---

## Quick Setup Script

Run all commands at once:

```bash
# Backend
cd /root/AK_Dialer/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd /root/AK_Dialer/frontend
npm install
npm run build

# Install services
sudo cp /root/AK_Dialer/dialer-backend.service /etc/systemd/system/
sudo cp /root/AK_Dialer/dialer-frontend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable dialer-backend dialer-frontend
sudo systemctl start dialer-backend dialer-frontend

# Check status
sudo systemctl status dialer-backend
sudo systemctl status dialer-frontend
```

---

## Notes

- **Backend runs on:** http://163.245.208.168:8000
- **Frontend runs on:** http://163.245.208.168:3000
- **Backend API docs:** http://163.245.208.168:8000/docs
- Services auto-start on server reboot
- Logs are available via `journalctl`
