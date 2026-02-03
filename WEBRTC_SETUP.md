# WebRTC Browser-Based Softphone Setup Guide

This guide shows you how to set up a browser-based softphone so agents can make and receive calls directly from the web interface without needing external softphone software.

## 🎯 Solution Overview

**Browser-Based WebRTC Softphone** - Agents use their browser (Chrome, Firefox, Edge) to make and receive calls directly in the dialer interface.

## ✅ Benefits

- ✅ No external softphone software needed
- ✅ Works on any device with a modern browser
- ✅ Integrated directly into the dialer interface
- ✅ Automatic microphone/speaker access
- ✅ Works with existing Asterisk setup

## 📋 Setup Steps

### Step 1: Configure Asterisk for WebRTC

Edit `/etc/asterisk/pjsip.conf` and add WebRTC endpoints for your agents:

```ini
; WebRTC Transport (WSS - WebSocket Secure)
[transport-wss]
type=transport
protocol=wss
bind=0.0.0.0:8089

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

[8013-webrtc]
type=auth
auth_type=userpass
password=password123
username=8013

[8013-webrtc]
type=aor
max_contacts=1
contact=sip:8013@0.0.0.0:8089

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

[8014-webrtc]
type=auth
auth_type=userpass
password=password123
username=8014

[8014-webrtc]
type=aor
max_contacts=1
contact=sip:8014@0.0.0.0:8089
```

### Step 2: Update Dialplan for WebRTC

Edit `/etc/asterisk/extensions.conf` to handle WebRTC calls:

```ini
[from-internal]
; WebRTC agent extensions
exten => 8013,1,NoOp(Calling Agent 8013 via WebRTC)
exten => 8013,n,Dial(PJSIP/8013-webrtc,30)
exten => 8013,n,Hangup()

exten => 8014,1,NoOp(Calling Agent 8014 via WebRTC)
exten => 8014,n,Dial(PJSIP/8014-webrtc,30)
exten => 8014,n,Hangup()

; Outbound calls - Route to Naya Tel trunk
exten => _X.,1,NoOp(Outbound call to ${EXTEN})
exten => _X.,n,Set(CALLERID(num)=0516125672)
exten => _X.,n,Set(CALLERID(name)=Your Company Name)
exten => _X.,n,Dial(${TRUNK}/${EXTEN},60)
exten => _X.,n,Hangup()
```

### Step 3: Open Firewall Ports

```bash
# Open WebSocket Secure port for WebRTC
sudo ufw allow 8089/tcp

# Verify
sudo ufw status | grep 8089
```

### Step 4: Install Frontend Dependencies

On your server or local machine:

```bash
cd frontend
npm install sip.js@^0.21.2
```

### Step 5: Reload Asterisk

```bash
sudo asterisk -rx "module reload res_pjsip.so"
sudo asterisk -rx "dialplan reload"

# Verify WebRTC transport is running
sudo asterisk -rx "pjsip show transports" | grep wss
```

### Step 6: Update Backend Config (Optional)

If you want to use WebRTC endpoints specifically, update `backend/app/core/config.py`:

```python
ASTERISK_WEBRTC_PORT: int = 8089
ASTERISK_WEBRTC_SERVER: str = "wss://163.245.208.168:8089/ws"
```

## 🧪 Testing

### Test WebRTC Registration

1. Open browser console (F12)
2. The softphone will auto-register when agent logs in
3. Check Asterisk: `sudo asterisk -rx "pjsip show endpoint 8013-webrtc"`

### Test Outbound Call

1. Agent logs into dialer
2. WebRTC softphone auto-connects
3. Agent dials a number from the dialer
4. Call should connect through browser

### Test Inbound Call

1. Call comes to your inbound number
2. Asterisk routes to agent's WebRTC extension
3. Browser should show incoming call notification
4. Agent can answer from browser

## 🔧 Troubleshooting

### Issue: WebRTC not connecting

**Check:**
- Port 8089 is open in firewall
- Asterisk WebRTC transport is running
- Browser has microphone permission
- HTTPS/WSS is accessible (required for WebRTC)

**Solution:**
```bash
# Check transport
sudo asterisk -rx "pjsip show transports"

# Check endpoint
sudo asterisk -rx "pjsip show endpoint 8013-webrtc"

# Check logs
sudo tail -f /var/log/asterisk/messages.log | grep webrtc
```

### Issue: No audio

**Check:**
- Browser microphone permission granted
- Browser speaker/headphone volume
- Asterisk RTP ports (10000-20000) are open

**Solution:**
- Grant microphone permission in browser
- Check browser audio settings
- Verify RTP ports: `sudo ufw allow 10000:20000/udp`

### Issue: Registration fails

**Check:**
- WebRTC endpoint configuration in `pjsip.conf`
- Username/password match
- WSS transport is bound correctly

**Solution:**
```bash
# Verify endpoint config
sudo asterisk -rx "pjsip show endpoint 8013-webrtc"

# Check registration attempts
sudo tail -f /var/log/asterisk/messages.log | grep 8013
```

## 📝 Notes

- **HTTPS Required**: WebRTC requires secure connection (WSS). Your frontend must be served over HTTPS, or use a reverse proxy with SSL.
- **Browser Support**: Works in Chrome, Firefox, Edge, Safari (latest versions)
- **Microphone Permission**: Browser will prompt for microphone access on first use
- **Network**: WebRTC works best on stable internet connections

## 🚀 Alternative: Use Existing PJSIP Endpoints

If you prefer to keep using your existing PJSIP endpoints (8013, 8014) and just add WebRTC support, you can modify the existing endpoints to support both SIP and WebRTC by adding `webrtc=yes` to them.

## Next Steps

1. Configure Asterisk WebRTC endpoints (Step 1)
2. Install SIP.js in frontend (Step 4)
3. The softphone component will auto-connect when agent logs in
4. Test making a call from the dialer interface

Once configured, agents can make and receive calls directly from their browser! 🎉
