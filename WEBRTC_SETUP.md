# WebRTC Setup Guide

## Overview
WebRTC allows agents to make and receive calls directly from the web browser without needing external softphones like Zoiper.

## Asterisk Configuration

### 1. Enable WebRTC Transport in PJSIP

Add to `/etc/asterisk/pjsip.conf`:

```ini
[transport-wss]
type=transport
protocol=wss
bind=0.0.0.0:8089
external_media_address=101.50.86.185
external_signaling_address=101.50.86.185
local_net=172.16.180.0/23
```

### 2. Update Extension Endpoints

Add WebRTC transport to your extensions in `pjsip.conf`:

```ini
[8013]
type=endpoint
context=from-internal
disallow=all
allow=ulaw
allow=alaw
allow=opus
auth=8013
aors=8013
callerid="Agent 8013" <8013>
transport=transport-udp
transport=transport-wss  ; Add this line
media_address=101.50.86.185
rtp_symmetric=yes
force_rport=yes
rewrite_contact=yes
direct_media=no
ice_support=yes
dtmf_mode=rfc4733
```

### 3. Reload Asterisk Configuration

```bash
sudo asterisk -rx "module reload res_pjsip"
```

## Frontend Configuration

### Environment Variables

**Option 1: Add to `frontend/.env.local` (Recommended):**

Create or update `frontend/.env.local`:
```env
NEXT_PUBLIC_WEBRTC_SERVER=wss://101.50.86.185:8089/ws
```

**Option 2: Add to `backend/.env` (if using shared config):**

Add to `backend/.env`:
```env
NEXT_PUBLIC_WEBRTC_SERVER=wss://101.50.86.185:8089/ws
```

**Option 3: Already configured in `frontend/next.config.js`:**

The default is already set in `next.config.js`:
```js
NEXT_PUBLIC_WEBRTC_SERVER: process.env.NEXT_PUBLIC_WEBRTC_SERVER || 'wss://101.50.86.185:8089/ws',
```

**Note:** For production, set this in your deployment environment variables or `.env.local` file.

## How It Works

1. **Agent Login**: WebRTC automatically connects when agent logs in
2. **Manual Dial**: Click "Dial" - calls go through WebRTC if enabled
3. **Dial Next**: Automatically uses WebRTC for contact dialing
4. **Call Tracking**: All calls are tracked via AMI events (same as before)

## Features

- ✅ **Browser-based calling** - No external softphone needed
- ✅ **Automatic connection** - Connects on login
- ✅ **Toggle WebRTC** - Enable/disable via checkbox
- ✅ **Status indicator** - Shows connection status
- ✅ **Fallback support** - Falls back to AMI if WebRTC fails

## Troubleshooting

### WebRTC Not Connecting (Error 1006)

**Error 1006** means the WebSocket connection closed abnormally. Common causes:

#### 1. Check Asterisk WebRTC Transport is Configured

```bash
# Check if transport-wss exists
sudo asterisk -rx "pjsip show transports"
```

**Expected output should include:**
```
Transport: transport-wss
    protocol: wss
    bind: 0.0.0.0:8089
```

**If missing, add to `/etc/asterisk/pjsip.conf`:**
```ini
[transport-wss]
type=transport
protocol=wss
bind=0.0.0.0:8089
external_media_address=101.50.86.185
external_signaling_address=101.50.86.185
local_net=172.16.180.0/23
```

Then reload:
```bash
sudo asterisk -rx "module reload res_pjsip"
```

#### 2. Check Port 8089 is Open and Listening

```bash
# Check if port 8089 is listening
sudo netstat -tlnp | grep 8089
# OR
sudo ss -tlnp | grep 8089
```

**If not listening, check:**
- Firewall allows port 8089:
  ```bash
  sudo ufw allow 8089/tcp
  # OR for iptables
  sudo iptables -A INPUT -p tcp --dport 8089 -j ACCEPT
  ```

- Asterisk is running:
  ```bash
  sudo systemctl status asterisk
  ```

#### 3. Check SSL/TLS Certificate (for WSS)

WSS requires SSL. If using self-signed cert, browser may block it.

**Option A: Use WS instead of WSS (less secure, for testing):**
- Change `wss://` to `ws://` in frontend config
- Update Asterisk transport to `protocol=ws` instead of `wss`

**Option B: Configure proper SSL certificate:**
- Install SSL certificate for your domain
- Configure Asterisk to use it

#### 4. Verify Extension Has WebRTC Transport

```bash
# Check extension configuration
sudo asterisk -rx "pjsip show endpoint 8013"
```

**Should show:**
```
Transport: transport-udp, transport-wss
```

**If missing, add to extension in `pjsip.conf`:**
```ini
transport=transport-udp
transport=transport-wss  ; Add this line
```

#### 5. Check Browser Console

Open browser DevTools (F12) → Console tab:
- Look for WebSocket connection errors
- Check for CORS or SSL certificate errors

#### 6. Test WebSocket Connection Manually

```bash
# Test if WebSocket port is accessible
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: test" \
  https://101.50.86.185:8089/ws
```

### Quick Fix Checklist

1. ✅ Add `[transport-wss]` section to `/etc/asterisk/pjsip.conf`
2. ✅ Add `transport=transport-wss` to extension endpoints
3. ✅ Reload: `sudo asterisk -rx "module reload res_pjsip"`
4. ✅ Open firewall: `sudo ufw allow 8089/tcp`
5. ✅ Verify: `sudo asterisk -rx "pjsip show transports"`
6. ✅ Check browser console for errors

### Calls Not Going Through

1. Verify dialplan routes WebRTC calls correctly
2. Check Asterisk logs:
   ```bash
   sudo tail -f /var/log/asterisk/messages.log
   ```

3. Ensure extension has both `transport-udp` and `transport-wss`

## Security Notes

- WebRTC uses WSS (secure WebSocket) on port 8089
- Ensure proper firewall rules
- Use HTTPS for production (required for WebRTC in browsers)
- For testing, you can use `ws://` instead of `wss://` (less secure)
