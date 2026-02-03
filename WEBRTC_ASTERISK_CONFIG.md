# Asterisk WebRTC Configuration for Browser-Based Softphone

This guide shows you how to configure Asterisk to support WebRTC so agents can make and receive calls directly from their browser.

## 🎯 Solution: Browser-Based WebRTC Softphone

**No external softphone needed!** Agents use their browser (Chrome, Firefox, Edge) to make and receive calls.

## 📋 Step-by-Step Setup

### Step 1: Configure Asterisk WebRTC Transport

Edit `/etc/asterisk/pjsip.conf`:

```bash
sudo nano /etc/asterisk/pjsip.conf
```

Add WebRTC transport at the top (after existing transports):

```ini
; WebRTC Transport (WSS - WebSocket Secure)
; This allows browsers to connect via WebRTC
[transport-wss]
type=transport
protocol=wss
bind=0.0.0.0:8089
```

### Step 2: Add WebRTC Endpoints for Agents

Add WebRTC endpoints for each agent. You can either:
- **Option A**: Create separate WebRTC endpoints (8013-webrtc, 8014-webrtc)
- **Option B**: Add WebRTC support to existing endpoints

**Option A (Recommended - Separate WebRTC endpoints):**

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

[8014-webrtc]
type=auth
auth_type=userpass
password=password123
username=8014

[8014-webrtc]
type=aor
max_contacts=1
```

**Option B (Add to existing endpoints):**

Just add these lines to your existing `[8013]` and `[8014]` endpoints:

```ini
webrtc=yes
ice_support=yes
transport=transport-wss
```

### Step 3: Update Dialplan for WebRTC

Edit `/etc/asterisk/extensions.conf`:

```bash
sudo nano /etc/asterisk/extensions.conf
```

Update to use WebRTC endpoints (if using Option A) or keep existing (if using Option B):

```ini
[from-internal]
; Agent extensions - use WebRTC endpoints
exten => 8013,1,NoOp(Calling Agent 8013 via WebRTC)
exten => 8013,n,Dial(PJSIP/8013-webrtc,30)  ; Use -webrtc endpoint
exten => 8013,n,Hangup()

exten => 8014,1,NoOp(Calling Agent 8014 via WebRTC)
exten => 8014,n,Dial(PJSIP/8014-webrtc,30)  ; Use -webrtc endpoint
exten => 8014,n,Hangup()

; Outbound calls - Route to Naya Tel trunk
exten => _X.,1,NoOp(Outbound call to ${EXTEN})
exten => _X.,n,Set(CALLERID(num)=0516125672)
exten => _X.,n,Set(CALLERID(name)=Your Company Name)
exten => _X.,n,Dial(${TRUNK}/${EXTEN},60)
exten => _X.,n,Hangup()
```

### Step 4: Open Firewall Ports

```bash
# Open WebSocket Secure port for WebRTC
sudo ufw allow 8089/tcp

# Verify
sudo ufw status | grep 8089
```

### Step 5: Reload Asterisk

```bash
# Reload PJSIP
sudo asterisk -rx "module reload res_pjsip.so"

# Reload dialplan
sudo asterisk -rx "dialplan reload"

# Verify WebRTC transport is running
sudo asterisk -rx "pjsip show transports" | grep wss
```

### Step 6: Install Frontend Dependencies

On your server:

```bash
cd /root/AK_Dialer/frontend
npm install sip.js@^0.21.2
npm run build
sudo systemctl restart dialer-frontend
```

### Step 7: Configure HTTPS (Required for WebRTC)

**WebRTC requires HTTPS/WSS (secure connection).** You have two options:

**Option 1: Use Nginx Reverse Proxy with SSL**

```bash
# Install Nginx
sudo apt install nginx certbot python3-certbot-nginx

# Configure Nginx (create /etc/nginx/sites-available/dialer)
server {
    listen 443 ssl;
    server_name 163.245.208.168;

    ssl_certificate /etc/letsencrypt/live/163.245.208.168/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/163.245.208.168/privkey.pem;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket for WebRTC
    location /ws {
        proxy_pass http://localhost:8089;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

# Get SSL certificate
sudo certbot --nginx -d 163.245.208.168
```

**Option 2: Use Self-Signed Certificate (For Testing)**

```bash
# Generate self-signed certificate
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/asterisk-webrtc.key \
  -out /etc/ssl/certs/asterisk-webrtc.crt

# Update Asterisk to use certificate
# Edit /etc/asterisk/http.conf
[general]
enabled=yes
bindaddr=0.0.0.0
bindport=8088
prefix=asterisk

# Edit /etc/asterisk/pjsip.conf transport-wss
[transport-wss]
type=transport
protocol=wss
bind=0.0.0.0:8089
cert_file=/etc/ssl/certs/asterisk-webrtc.crt
priv_key_file=/etc/ssl/private/asterisk-webrtc.key
```

### Step 8: Update Frontend WebRTC Server URL

The WebRTC softphone needs to know the WSS server address. Update it in the component or via environment variable:

```bash
# In frontend, the default is: wss://163.245.208.168:8089/ws
# If using Nginx proxy, it might be: wss://163.245.208.168/ws
```

## 🧪 Testing

### Test WebRTC Registration

1. Agent logs into dialer
2. Browser should request microphone permission
3. Check Asterisk: `sudo asterisk -rx "pjsip show endpoint 8013-webrtc"`
4. Should show "Available" status

### Test Outbound Call

1. Agent dials a number from dialer interface
2. Backend originates call to agent's WebRTC extension
3. Browser should ring/show incoming call
4. Agent answers in browser
5. Call connects to customer

### Test Inbound Call

1. Someone calls your inbound number
2. Asterisk routes to agent's WebRTC extension
3. Browser shows incoming call notification
4. Agent answers from browser

## 🔧 Troubleshooting

### Issue: WebRTC not connecting

**Check:**
```bash
# Verify transport is running
sudo asterisk -rx "pjsip show transports" | grep wss

# Check endpoint status
sudo asterisk -rx "pjsip show endpoint 8013-webrtc"

# Check logs
sudo tail -f /var/log/asterisk/messages.log | grep webrtc
```

### Issue: Browser shows "Connection failed"

**Possible causes:**
- Port 8089 not open in firewall
- SSL certificate issue (WebRTC requires HTTPS/WSS)
- Wrong server URL in frontend

**Solution:**
- Verify firewall: `sudo ufw status`
- Check SSL certificate is valid
- Verify WSS URL in browser console

### Issue: No audio

**Check:**
- Browser microphone permission granted
- Browser speaker/headphone volume
- RTP ports (10000-20000) are open: `sudo ufw allow 10000:20000/udp`

## 📝 Important Notes

1. **HTTPS Required**: WebRTC requires secure connection (WSS). Your frontend must be served over HTTPS.
2. **Browser Support**: Works in Chrome, Firefox, Edge, Safari (latest versions)
3. **Microphone Permission**: Browser will prompt for microphone access
4. **Network**: WebRTC works best on stable internet connections

## 🚀 Quick Start (Simplified)

If you want to test quickly without SSL setup:

1. Configure WebRTC transport and endpoints (Steps 1-2)
2. Open port 8089
3. Reload Asterisk
4. Install SIP.js: `npm install sip.js@^0.21.2`
5. The softphone will auto-connect when agent logs in

**Note**: For production, you MUST set up HTTPS/WSS properly.

## Alternative: Keep Current Flow + WebRTC

You can keep your existing PJSIP endpoints (8013, 8014) for external softphones AND add WebRTC endpoints (8013-webrtc, 8014-webrtc) for browser-based calling. Agents can choose which to use!
