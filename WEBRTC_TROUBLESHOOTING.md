# WebRTC Troubleshooting Guide

## Current Status
- ✅ Asterisk transport `transport-ws` is configured correctly
- ✅ Endpoint 8013 is using `transport-ws`
- ❌ WebRTC still showing disconnected

## Diagnostic Steps

### 1. Check Port 8089 is Accessible

**On Asterisk Server:**
```bash
# Check if port is listening
sudo ss -tlnp | grep 8089
# Should show: LISTEN 0 128 0.0.0.0:8089

# Check firewall
sudo ufw status | grep 8089
# OR
sudo iptables -L -n | grep 8089
```

**If port not accessible, open it:**
```bash
sudo ufw allow 8089/tcp
# OR
sudo iptables -A INPUT -p tcp --dport 8089 -j ACCEPT
sudo iptables-save
```

### 2. Test WebSocket Connection from Browser

Open browser console (F12) and run:
```javascript
const ws = new WebSocket('ws://101.50.86.185:8089/ws');
ws.onopen = () => console.log('WebSocket connected!');
ws.onerror = (e) => console.error('WebSocket error:', e);
ws.onclose = (e) => console.log('WebSocket closed:', e.code, e.reason);
```

**Expected:** Should connect successfully
**If fails:** Port 8089 is blocked or not accessible

### 3. Check Browser Console Errors

Open browser DevTools (F12) → Console tab and look for:
- WebSocket connection errors
- SIP.js errors
- CORS errors
- Mixed content errors (if using HTTPS)

### 4. Check Asterisk Logs

```bash
# Watch Asterisk logs in real-time
sudo tail -f /var/log/asterisk/messages.log

# Then try connecting from browser
# Look for WebSocket connection attempts
```

### 5. Verify WebRTC URL in Frontend

Check browser console for:
```
Connecting to WebRTC server: ws://101.50.86.185:8089/ws
Username: 8013, Domain: 101.50.86.185
```

**If URL is wrong, check:**
- `frontend/.env.local` has `NEXT_PUBLIC_WEBRTC_SERVER=ws://101.50.86.185:8089/ws`
- Or `frontend/next.config.js` default value

### 6. Test from Different Network

If possible, test from a different network to rule out:
- ISP blocking port 8089
- Corporate firewall
- VPN issues

### 7. Check SIP.js Registration

In browser console, you should see:
```
WebRTC UserAgent started, attempting registration...
Registration state: Registered
WebRTC Softphone connected and registered
```

**If you see errors, check:**
- Username/password correct
- Extension exists in Asterisk
- Auth credentials match

## Common Issues

### Issue 1: Port 8089 Blocked by Firewall
**Solution:** Open port 8089 on server firewall and any network firewall

### Issue 2: Browser Blocks Mixed Content
**If frontend is HTTPS and trying to connect to WS:**
- Browsers block mixed content (HTTPS → WS)
- **Solution:** Use `wss://` with SSL certificate, OR serve frontend over HTTP

### Issue 3: SIP.js Connection Timeout
**Solution:** Check network connectivity, firewall rules, and Asterisk is running

### Issue 4: Wrong WebRTC URL
**Solution:** Verify `NEXT_PUBLIC_WEBRTC_SERVER` environment variable

## Quick Test Commands

```bash
# Test port from server
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: test" \
  http://101.50.86.185:8089/ws

# Check if Asterisk is listening
sudo lsof -i :8089

# Check firewall rules
sudo ufw status numbered
```

## Next Steps

1. Run the browser console WebSocket test (step 2)
2. Check browser console for specific errors
3. Check Asterisk logs when attempting connection
4. Verify port 8089 is accessible from your browser's network
