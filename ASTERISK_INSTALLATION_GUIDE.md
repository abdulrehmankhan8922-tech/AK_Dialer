# 🎯 Asterisk Installation Guide - Local PC & Docker

Complete guide to install and configure Asterisk for your dialer project.

---

## 📋 Table of Contents

1. [Local Installation (Windows)](#local-installation-windows)
2. [Local Installation (Linux)](#local-installation-linux)
3. [Local Installation (macOS)](#local-installation-macos)
4. [Docker Installation](#docker-installation)
5. [Configuration](#configuration)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

---

## 🪟 Local Installation (Windows)

### Option 1: Using WSL2 (Recommended)

**Why WSL2?** Asterisk runs natively on Linux. WSL2 provides a Linux environment on Windows.

#### Step 1: Install WSL2

```powershell
# Open PowerShell as Administrator
wsl --install

# Restart your computer when prompted
```

#### Step 2: Install Ubuntu in WSL2

```bash
# After restart, open Ubuntu from Start Menu
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Asterisk
sudo apt install asterisk -y

# Start Asterisk
sudo service asterisk start
```

#### Step 3: Access Asterisk from Windows

Asterisk will be accessible at `localhost` from your Windows applications.

---

### Option 2: Using VirtualBox/VMware

1. **Install VirtualBox** (free): https://www.virtualbox.org/
2. **Download Ubuntu ISO**: https://ubuntu.com/download
3. **Create VM** with:
   - 2GB RAM minimum
   - 20GB disk space
   - Network: Bridged or NAT
4. **Install Ubuntu** in VM
5. **Follow Linux installation steps** below

---

### Option 3: Native Windows (Advanced - Not Recommended)

Asterisk can be compiled on Windows, but it's complex. Use WSL2 instead.

---

## 🐧 Local Installation (Linux)

### Ubuntu/Debian

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Asterisk
sudo apt install asterisk -y

# Install additional tools
sudo apt install asterisk-dev asterisk-doc -y

# Start Asterisk
sudo systemctl start asterisk
sudo systemctl enable asterisk

# Check status
sudo systemctl status asterisk

# Access Asterisk CLI
sudo asterisk -rvvv
```

### CentOS/RHEL/Fedora

```bash
# Install EPEL repository
sudo yum install epel-release -y

# Install Asterisk
sudo yum install asterisk -y

# Start Asterisk
sudo systemctl start asterisk
sudo systemctl enable asterisk

# Check status
sudo systemctl status asterisk
```

### Verify Installation

```bash
# Check version
sudo asterisk -rx "core show version"

# Check modules
sudo asterisk -rx "module show"

# Exit CLI
exit
```

---

## 🍎 Local Installation (macOS)

### Using Homebrew (Recommended)

```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Asterisk
brew install asterisk

# Start Asterisk
brew services start asterisk

# Check status
brew services list | grep asterisk
```

### Manual Installation

```bash
# Install dependencies
brew install pkg-config libedit openssl

# Download Asterisk source
cd ~/Downloads
wget http://downloads.asterisk.org/pub/telephony/asterisk/asterisk-20-current.tar.gz
tar -xzf asterisk-20-current.tar.gz
cd asterisk-20.*

# Configure and compile
./configure
make
sudo make install
sudo make samples

# Start Asterisk
sudo asterisk -f
```

---

## 🐳 Docker Installation (Recommended for Development)

### Why Docker?

- ✅ Easy setup and cleanup
- ✅ Consistent environment
- ✅ No system modifications
- ✅ Easy to reset
- ✅ Works on Windows, Mac, Linux

### Step 1: Install Docker

**Windows/Mac:**
- Download Docker Desktop: https://www.docker.com/products/docker-desktop
- Install and start Docker Desktop

**Linux:**
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Start Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group (optional)
sudo usermod -aG docker $USER
```

### Step 2: Create Docker Compose File

Create `docker-compose.yml` in your project root:

```yaml
version: '3.8'

services:
  asterisk:
    image: andrius/asterisk:latest
    container_name: dialer-asterisk
    ports:
      - "5038:5038"    # AMI port
      - "5060:5060/udp"  # SIP port
      - "5060:5060/tcp"  # SIP port (TCP)
      - "10000-10099:10000-10099/udp"  # RTP ports
    volumes:
      - ./asterisk-config:/etc/asterisk
      - ./asterisk-logs:/var/log/asterisk
    environment:
      - TZ=UTC
    restart: unless-stopped
    networks:
      - dialer-network

networks:
  dialer-network:
    driver: bridge
```

### Step 3: Create Configuration Directory

```bash
# Create directories
mkdir -p asterisk-config
mkdir -p asterisk-logs

# Set permissions (Linux/Mac)
chmod -R 777 asterisk-config
chmod -R 777 asterisk-logs
```

### Step 4: Create Configuration Files

#### `asterisk-config/manager.conf`

```ini
[general]
enabled = yes
port = 5038
bindaddr = 0.0.0.0

[admin]
secret = amp111
deny = 0.0.0.0/0.0.0.0
permit = 127.0.0.1/255.255.255.255
permit = 172.16.0.0/255.240.0.0  # Docker network
read = system,call,log,verbose,command,agent,user,config,dtmf,reporting,cdr,dialplan
write = system,call,log,verbose,command,agent,user,config,dtmf,reporting,cdr,dialplan
```

#### `asterisk-config/sip.conf`

```ini
[general]
context=default
allowoverlap=no
udpbindaddr=0.0.0.0:5060
tcpenable=yes
tcpbindaddr=0.0.0.0:5060
transport=udp,tcp

; RTP Settings
rtpstart=10000
rtpend=10099

; Agent Extensions
[8013]
type=friend
host=dynamic
secret=password123
context=from-internal
canreinvite=no
disallow=all
allow=ulaw
allow=alaw
allow=gsm
nat=force_rport,comedia

[8014]
type=friend
host=dynamic
secret=password123
context=from-internal
canreinvite=no
disallow=all
allow=ulaw
allow=alaw
allow=gsm
nat=force_rport,comedia

; SIP Trunk (for outbound calls)
; Replace with your actual SIP provider details
[trunk]
type=peer
host=sip.provider.com
username=your_username
secret=your_password
fromuser=your_username
context=from-internal
disallow=all
allow=ulaw
allow=alaw
nat=force_rport,comedia
```

#### `asterisk-config/extensions.conf`

```ini
[globals]
; SIP Trunk configuration
TRUNK=SIP/trunk

[default]
; Default context for incoming calls

[from-internal]
; Agent extensions
exten => 8013,1,Dial(SIP/8013,20)
exten => 8013,n,Hangup()

exten => 8014,1,Dial(SIP/8014,20)
exten => 8014,n,Hangup()

; Outbound dialing - Agent-first dialing
; When agent dials a number, ring agent first, then dial customer
exten => _X.,1,NoOp(Outbound call to ${EXTEN})
exten => _X.,n,Set(CALLERID(num)=${EXTEN})
exten => _X.,n,Dial(${TRUNK}/${EXTEN},60)
exten => _X.,n,Hangup()

; Inbound calls
[from-trunk]
exten => _X.,1,NoOp(Incoming call to ${EXTEN})
exten => _X.,n,Dial(SIP/8013,20)
exten => _X.,n,Dial(SIP/8014,20)
exten => _X.,n,Hangup()
```

#### `asterisk-config/rtp.conf`

```ini
[general]
rtpstart=10000
rtpend=10099
```

### Step 5: Start Asterisk with Docker

```bash
# Start Asterisk
docker-compose up -d

# Check logs
docker-compose logs -f asterisk

# Access Asterisk CLI
docker exec -it dialer-asterisk asterisk -rvvv

# Stop Asterisk
docker-compose down

# Restart Asterisk
docker-compose restart
```

---

## ⚙️ Configuration

### Step 1: Configure Backend

Update `backend/.env`:

```env
# Asterisk AMI Settings
ASTERISK_HOST=localhost
ASTERISK_AMI_PORT=5038
ASTERISK_AMI_USERNAME=admin
ASTERISK_AMI_PASSWORD=amp111
ASTERISK_CONTEXT=from-internal
ASTERISK_TRUNK=SIP/trunk

# Enable real Asterisk (set to False for mock mode)
USE_MOCK_DIALER=False
```

**For Docker:** If backend is also in Docker, use `asterisk` as hostname instead of `localhost`.

### Step 2: Reload Asterisk Configuration

**Local Installation:**
```bash
sudo asterisk -rx "core reload"
```

**Docker:**
```bash
docker exec -it dialer-asterisk asterisk -rx "core reload"
```

---

## 🧪 Testing

### Test 1: Check Asterisk is Running

**Local:**
```bash
sudo asterisk -rx "core show version"
```

**Docker:**
```bash
docker exec -it dialer-asterisk asterisk -rx "core show version"
```

**Expected Output:**
```
Asterisk 20.x.x built by ...
```

### Test 2: Test AMI Connection

```bash
# Test AMI port
telnet localhost 5038

# Should see:
# Asterisk Call Manager/1.x
```

### Test 3: Test SIP Registration

1. **Install SIP Client:**
   - **Windows/Mac/Linux:** Zoiper (free): https://www.zoiper.com/
   - **Android/iOS:** Zoiper Mobile (free)

2. **Configure SIP Client:**
   - **SIP Server:** `localhost` (or Docker container IP)
   - **Port:** `5060`
   - **Username:** `8013`
   - **Password:** `password123`
   - **Display Name:** `Agent 8013`

3. **Register:**
   - Should see "Registered" status
   - Check in Asterisk: `sudo asterisk -rx "sip show peers"`

### Test 4: Test AMI from Python

Create `test_ami.py`:

```python
import asyncio
import socket

async def test_ami():
    # Connect to AMI
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.connect(('localhost', 5038))
    
    # Read welcome message
    welcome = sock.recv(1024).decode()
    print(f"Welcome: {welcome}")
    
    # Login
    login = "Action: Login\r\n"
    login += "Username: admin\r\n"
    login += "Secret: amp111\r\n"
    login += "\r\n"
    
    sock.send(login.encode())
    response = sock.recv(1024).decode()
    print(f"Login Response: {response}")
    
    # Get status
    status = "Action: Status\r\n"
    status += "\r\n"
    sock.send(status.encode())
    response = sock.recv(4096).decode()
    print(f"Status: {response}")
    
    sock.close()

asyncio.run(test_ami())
```

Run:
```bash
python test_ami.py
```

### Test 5: Test from Your Dialer

1. **Start Backend:**
   ```bash
   cd backend
   uvicorn app.main:app --reload
   ```

2. **Check Logs:**
   - Should see: "AMI event listener connected"
   - No connection errors

3. **Make Test Call:**
   - Login as agent
   - Try manual dial
   - Check Asterisk logs

---

## 🔧 Troubleshooting

### Issue 1: Asterisk Won't Start

**Symptoms:** Service fails to start

**Solutions:**
```bash
# Check logs
sudo journalctl -u asterisk -n 50

# Check configuration
sudo asterisk -rx "core show settings"

# Test configuration
sudo asterisk -C /etc/asterisk/asterisk.conf -vvv
```

### Issue 2: AMI Connection Failed

**Symptoms:** Backend can't connect to AMI

**Solutions:**
1. **Check AMI is enabled:**
   ```bash
   sudo asterisk -rx "manager show settings"
   ```

2. **Check firewall:**
   ```bash
   # Linux
   sudo ufw allow 5038/tcp
   
   # Windows Firewall
   # Allow port 5038 in Windows Firewall settings
   ```

3. **Check bind address:**
   - In `manager.conf`, ensure `bindaddr = 0.0.0.0`

### Issue 3: SIP Registration Fails

**Symptoms:** SIP client can't register

**Solutions:**
1. **Check SIP peers:**
   ```bash
   sudo asterisk -rx "sip show peers"
   ```

2. **Check SIP settings:**
   ```bash
   sudo asterisk -rx "sip show settings"
   ```

3. **Check NAT settings:**
   - In `sip.conf`, add: `nat=force_rport,comedia`

### Issue 4: Docker Container Can't Access Host

**Symptoms:** Backend in Docker can't connect to Asterisk

**Solutions:**
1. **Use Docker network:**
   - Put both services in same `docker-compose.yml`
   - Use service name as hostname

2. **Use host network (Linux only):**
   ```yaml
   network_mode: "host"
   ```

3. **Use host.docker.internal (Windows/Mac):**
   - In backend config: `ASTERISK_HOST=host.docker.internal`

### Issue 5: RTP Audio Issues

**Symptoms:** No audio in calls

**Solutions:**
1. **Check RTP ports:**
   ```bash
   sudo asterisk -rx "rtp show settings"
   ```

2. **Open RTP ports in firewall:**
   ```bash
   sudo ufw allow 10000:10099/udp
   ```

3. **Check NAT:**
   - Ensure `nat=force_rport,comedia` in `sip.conf`

---

## 📝 Quick Reference

### Useful Asterisk Commands

```bash
# Connect to CLI
sudo asterisk -rvvv

# Reload configuration
core reload

# Show SIP peers
sip show peers

# Show channels
core show channels

# Show version
core show version

# Show AMI users
manager show users

# Show dialplan
dialplan show from-internal

# Exit CLI
exit
```

### Docker Commands

```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# View logs
docker-compose logs -f asterisk

# Restart
docker-compose restart asterisk

# Access CLI
docker exec -it dialer-asterisk asterisk -rvvv

# Rebuild
docker-compose up -d --build
```

---

## 🎯 Next Steps

1. ✅ **Asterisk Installed** - You're ready!
2. 📝 **Configure SIP Trunk** - Add your provider details
3. 🔧 **Test AMI Connection** - Verify backend can connect
4. 📞 **Test SIP Registration** - Register a softphone
5. 🧪 **Make Test Call** - Try dialing from your dialer

---

## 📚 Additional Resources

- **Asterisk Documentation:** https://docs.asterisk.org/
- **Asterisk Wiki:** https://wiki.asterisk.org/
- **Docker Hub Asterisk:** https://hub.docker.com/r/andrius/asterisk
- **SIP Testing Tools:** https://www.sipvicious.org/

---

**Last Updated:** 2024
**Version:** 1.0
