# Hybrid WebRTC - Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Add WebRTC to Asterisk Config

On your server:

```bash
sudo nano /etc/asterisk/pjsip.conf
```

**Add at the top (after existing transports):**
```ini
[transport-wss]
type=transport
protocol=wss
bind=0.0.0.0:8089
```

**Add at the end (keep existing endpoints):**
```ini
; WebRTC Endpoint for Agent 8013
[8013-webrtc]
type=endpoint
context=from-internal
disallow=all
allow=ulaw
allow=alaw
allow=opus
aors=8013-webrtc
auth=8013-webrtc
webrtc=yes
rtp_symmetric=yes
force_rport=yes
rewrite_contact=yes
direct_media=no
ice_support=yes
dtmf_mode=rfc4733
transport=transport-wss
callerid=Agent 8013 <8013>

[8013-webrtc]
type=auth
auth_type=userpass
password=password123
username=8013

[8013-webrtc]
type=aor
max_contacts=1

; WebRTC Endpoint for Agent 8014
[8014-webrtc]
type=endpoint
context=from-internal
disallow=all
allow=ulaw
allow=alaw
allow=opus
aors=8014-webrtc
auth=8014-webrtc
webrtc=yes
rtp_symmetric=yes
force_rport=yes
rewrite_contact=yes
direct_media=no
ice_support=yes
dtmf_mode=rfc4733
transport=transport-wss
callerid=Agent 8014 <8014>

[8014-webrtc]
type=auth
auth_type=userpass
password=password123
username=8014

[8014-webrtc]
type=aor
max_contacts=1
```

### Step 2: Update Dialplan

```bash
sudo nano /etc/asterisk/extensions.conf
```

**Update agent extensions to use both:**
```ini
[from-internal]
; Agent 8013 - Try WebRTC first, then regular SIP
exten => 8013,1,NoOp(Calling Agent 8013)
exten => 8013,n,Dial(PJSIP/8013-webrtc&PJSIP/8013,30)
exten => 8013,n,Hangup()

; Agent 8014 - Try WebRTC first, then regular SIP
exten => 8014,1,NoOp(Calling Agent 8014)
exten => 8014,n,Dial(PJSIP/8014-webrtc&PJSIP/8014,30)
exten => 8014,n,Hangup()
```

### Step 3: Open Ports

```bash
sudo ufw allow 8089/tcp
sudo ufw reload
```

### Step 4: Reload Asterisk

```bash
sudo asterisk -rx "module reload res_pjsip.so"
sudo asterisk -rx "dialplan reload"
```

### Step 5: Install Frontend Dependencies

```bash
cd /root/AK_Dialer/frontend
npm install sip.js@^0.21.2
npm run build
sudo systemctl restart dialer-frontend
```

### Step 6: Set Up HTTPS (Required)

**Option A: Quick Test (Self-Signed Certificate)**

```bash
# Generate certificate
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/asterisk-webrtc.key \
  -out /etc/ssl/certs/asterisk-webrtc.crt \
  -subj "/CN=163.245.208.168"

# Update pjsip.conf transport-wss
[transport-wss]
type=transport
protocol=wss
bind=0.0.0.0:8089
cert_file=/etc/ssl/certs/asterisk-webrtc.crt
priv_key_file=/etc/ssl/private/asterisk-webrtc.key

# Reload
sudo asterisk -rx "module reload res_pjsip.so"
```

**Option B: Production (Nginx + Let's Encrypt)**

See `HYBRID_WEBRTC_SETUP.md` Step 7 for full instructions.

## ✅ Verify Setup

```bash
# Check transports
sudo asterisk -rx "pjsip show transports" | grep -E "udp|tcp|wss"

# Check endpoints
sudo asterisk -rx "pjsip show endpoint 8013"
sudo asterisk -rx "pjsip show endpoint 8013-webrtc"
```

## 🧪 Test

1. **External Softphone**: Register Zoiper with `8013` / `password123` on port `5066`
2. **Browser**: Agent logs in at `https://163.245.208.168` (or `http://` with self-signed)
3. **Both should register**: Check with `sudo asterisk -rx "pjsip show endpoints"`
4. **Make a call**: Both should ring!

## 📝 What You Get

✅ External softphones work (port 5066)
✅ Browser WebRTC works (port 8089)
✅ Both can be registered simultaneously
✅ Calls ring both endpoints
✅ First to answer gets the call

## 🎉 Done!

Your hybrid setup is ready! Agents can now use either external softphones or browser-based calling.

For detailed configuration, see `HYBRID_WEBRTC_SETUP.md`.
