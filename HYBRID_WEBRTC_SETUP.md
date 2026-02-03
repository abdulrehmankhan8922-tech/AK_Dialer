# Hybrid WebRTC Setup Guide
## Keep External Softphones + Add Browser-Based Calling

This guide shows you how to set up **both** external softphones (Zoiper, etc.) **and** browser-based WebRTC calling, so agents can choose which to use.

## 🎯 Hybrid Approach Benefits

✅ **Flexibility**: Agents can use external softphones OR browser
✅ **No Breaking Changes**: Existing softphone setup continues to work
✅ **Progressive Migration**: Gradually move agents to browser-based calling
✅ **Backup Option**: If browser doesn't work, agent can use external softphone

## 📋 Setup Steps

### Step 1: Add WebRTC Transport to Asterisk

Edit `/etc/asterisk/pjsip.conf`:

```bash
sudo nano /etc/asterisk/pjsip.conf
```

Add WebRTC transport (keep your existing UDP/TCP transports):

```ini
; Existing transports (keep these)
[transport-udp]
type=transport
protocol=udp
bind=0.0.0.0:5066

[transport-tcp]
type=transport
protocol=tcp
bind=0.0.0.0:5066

; NEW: WebRTC Transport (WSS - WebSocket Secure)
[transport-wss]
type=transport
protocol=wss
bind=0.0.0.0:8089
```

### Step 2: Add WebRTC Endpoints (Keep Existing Endpoints)

Add WebRTC endpoints **alongside** your existing endpoints. Your existing `[8013]` and `[8014]` endpoints stay unchanged.

Add these **new** WebRTC endpoints at the end of `pjsip.conf`:

```ini
; ============================================
; WebRTC Endpoints (for browser-based calling)
; ============================================

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

**Important**: 
- Keep your existing `[8013]` and `[8014]` endpoints unchanged
- These new `[8013-webrtc]` and `[8014-webrtc]` endpoints are separate
- Both can be registered at the same time!

### Step 3: Update Dialplan for Both Endpoints

Edit `/etc/asterisk/extensions.conf`:

```bash
sudo nano /etc/asterisk/extensions.conf
```

Update the dialplan to try WebRTC first, then fall back to regular SIP:

```ini
[globals]
TRUNK=PJSIP/trunk

[from-internal]
; Agent 8013 - Try WebRTC first, then regular SIP
exten => 8013,1,NoOp(Calling Agent 8013)
exten => 8013,n,Dial(PJSIP/8013-webrtc&PJSIP/8013,30)
exten => 8013,n,Hangup()

; Agent 8014 - Try WebRTC first, then regular SIP
exten => 8014,1,NoOp(Calling Agent 8014)
exten => 8014,n,Dial(PJSIP/8014-webrtc&PJSIP/8014,30)
exten => 8014,n,Hangup()

; Outbound calls - Route to Naya Tel trunk
exten => _X.,1,NoOp(Outbound call to ${EXTEN} from ${CALLERID(num)})
exten => _X.,n,Set(CALLERID(num)=0516125672)
exten => _X.,n,Set(CALLERID(name)=Your Company Name)
exten => _X.,n,Dial(${TRUNK}/${EXTEN},60)
exten => _X.,n,Hangup()

[from-trunk]
; Incoming calls - Route to both WebRTC and regular SIP endpoints
exten => _X.,1,NoOp(Incoming call to ${EXTEN} from ${CALLERID(num)})
exten => _X.,n,Dial(PJSIP/8013-webrtc&PJSIP/8013&PJSIP/8014-webrtc&PJSIP/8014,20)
exten => _X.,n,Hangup()
```

**Explanation**:
- `PJSIP/8013-webrtc&PJSIP/8013` means: Try WebRTC endpoint first, if not available, try regular SIP endpoint
- Both endpoints can be registered simultaneously
- Asterisk will ring whichever is available

### Step 4: Open Firewall Ports

```bash
# WebRTC WebSocket port (already have 5066 for SIP)
sudo ufw allow 8089/tcp

# Verify
sudo ufw status | grep -E "5066|8089"
```

### Step 5: Reload Asterisk

```bash
# Reload PJSIP
sudo asterisk -rx "module reload res_pjsip.so"

# Reload dialplan
sudo asterisk -rx "dialplan reload"

# Verify both transports are running
sudo asterisk -rx "pjsip show transports"
```

### Step 6: Install Frontend Dependencies

```bash
cd /root/AK_Dialer/frontend
npm install sip.js@^0.21.2
npm run build
sudo systemctl restart dialer-frontend
```

### Step 7: Set Up HTTPS/WSS (Required for WebRTC)

WebRTC requires secure connection (WSS). You have two options:

#### Option A: Nginx Reverse Proxy with SSL (Recommended)

```bash
# Install Nginx and Certbot
sudo apt install nginx certbot python3-certbot-nginx

# Create Nginx config
sudo nano /etc/nginx/sites-available/dialer
```

Add this configuration:

```nginx
server {
    listen 443 ssl http2;
    server_name 163.245.208.168;

    # SSL Certificate (get from Let's Encrypt)
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

    # WebSocket for WebRTC (proxy to Asterisk WSS)
    location /ws {
        proxy_pass https://localhost:8089;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name 163.245.208.168;
    return 301 https://$server_name$request_uri;
}
```

Enable and get SSL:

```bash
sudo ln -s /etc/nginx/sites-available/dialer /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d 163.245.208.168
```

#### Option B: Self-Signed Certificate (For Testing)

```bash
# Generate self-signed certificate
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/asterisk-webrtc.key \
  -out /etc/ssl/certs/asterisk-webrtc.crt \
  -subj "/CN=163.245.208.168"

# Update Asterisk pjsip.conf transport-wss
[transport-wss]
type=transport
protocol=wss
bind=0.0.0.0:8089
cert_file=/etc/ssl/certs/asterisk-webrtc.crt
priv_key_file=/etc/ssl/private/asterisk-webrtc.key
```

**Note**: With self-signed certificate, browsers will show a warning. Click "Advanced" → "Proceed anyway" for testing.

## 🧪 Testing

### Test 1: Verify Both Endpoints Exist

```bash
# Check regular SIP endpoints
sudo asterisk -rx "pjsip show endpoint 8013"
sudo asterisk -rx "pjsip show endpoint 8014"

# Check WebRTC endpoints
sudo asterisk -rx "pjsip show endpoint 8013-webrtc"
sudo asterisk -rx "pjsip show endpoint 8014-webrtc"
```

### Test 2: Register External Softphone

1. Register Zoiper with:
   - Username: `8013`
   - Password: `password123`
   - Server: `163.245.208.168:5066`

2. Check registration:
   ```bash
   sudo asterisk -rx "pjsip show endpoint 8013" | grep -i contact
   ```

### Test 3: Register Browser WebRTC

1. Agent logs into dialer at `https://163.245.208.168` (or `http://` if using self-signed)
2. Browser should request microphone permission
3. Check registration:
   ```bash
   sudo asterisk -rx "pjsip show endpoint 8013-webrtc" | grep -i contact
   ```

### Test 4: Make a Call (Both Registered)

1. Both external softphone AND browser are registered
2. Make a call from dialer
3. Asterisk will ring **both** endpoints
4. First one to answer gets the call

### Test 5: Make a Call (Only One Registered)

1. Only browser is registered (external softphone disconnected)
2. Make a call from dialer
3. Only browser should ring

## 📊 How It Works

### Scenario 1: Both Registered
```
Agent has:
- External softphone (Zoiper) registered on 8013
- Browser WebRTC registered on 8013-webrtc

When call comes:
→ Asterisk dials: PJSIP/8013-webrtc&PJSIP/8013
→ Both ring simultaneously
→ First to answer gets the call
```

### Scenario 2: Only Browser Registered
```
Agent has:
- Only browser WebRTC registered on 8013-webrtc

When call comes:
→ Asterisk dials: PJSIP/8013-webrtc&PJSIP/8013
→ WebRTC endpoint rings (8013-webrtc)
→ Regular SIP endpoint doesn't ring (not registered)
→ Agent answers in browser
```

### Scenario 3: Only External Softphone Registered
```
Agent has:
- Only external softphone registered on 8013

When call comes:
→ Asterisk dials: PJSIP/8013-webrtc&PJSIP/8013
→ Regular SIP endpoint rings (8013)
→ WebRTC endpoint doesn't ring (not registered)
→ Agent answers in external softphone
```

## 🔧 Troubleshooting

### Issue: WebRTC not connecting

**Check:**
```bash
# Verify WebRTC transport
sudo asterisk -rx "pjsip show transports" | grep wss

# Check endpoint
sudo asterisk -rx "pjsip show endpoint 8013-webrtc"

# Check logs
sudo tail -f /var/log/asterisk/messages.log | grep webrtc
```

### Issue: Both endpoints ring but only one should

**Solution**: This is expected behavior! The `&` operator in Dial() means "ring both". If you want to prioritize one, use:

```ini
; Try WebRTC first, only if unavailable try regular SIP
exten => 8013,1,Dial(PJSIP/8013-webrtc,20)
exten => 8013,n,Dial(PJSIP/8013,20)
```

### Issue: External softphone works but browser doesn't

**Check:**
- HTTPS/WSS is configured correctly
- Port 8089 is open
- Browser has microphone permission
- SSL certificate is valid

## ✅ Verification Checklist

- [ ] WebRTC transport added to `pjsip.conf`
- [ ] WebRTC endpoints (8013-webrtc, 8014-webrtc) added
- [ ] Existing endpoints (8013, 8014) still work
- [ ] Dialplan updated to use both endpoints
- [ ] Port 8089 opened in firewall
- [ ] HTTPS/WSS configured
- [ ] Frontend dependencies installed
- [ ] External softphone can register
- [ ] Browser WebRTC can register
- [ ] Both can be registered simultaneously
- [ ] Calls work with either endpoint

## 🎉 Result

After setup, you'll have:

✅ **External softphones** (Zoiper, etc.) continue to work on ports 5066
✅ **Browser WebRTC** works on port 8089 (WSS)
✅ **Agents can choose** which to use
✅ **Both can work simultaneously** (backup option)
✅ **No breaking changes** to existing setup

## 📝 Summary

The hybrid approach gives you:
- **Flexibility**: Use external softphone OR browser
- **Reliability**: If one fails, the other works
- **Gradual Migration**: Move agents to browser one by one
- **Best of Both Worlds**: External softphones for power users, browser for convenience

Your existing setup continues to work, and you've added browser-based calling as an option! 🚀
