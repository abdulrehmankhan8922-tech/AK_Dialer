# Softphone Quick Reference Card

## 📱 Quick Configuration

### Extension 8013 (Agent 1)
```
Username: 8013
Password: password123
Server: localhost (or your server IP)
Port: 5060
Transport: UDP (or TCP if UDP doesn't work)
```

### Extension 8014 (Agent 2)
```
Username: 8014
Password: password123
Server: localhost (or your server IP)
Port: 5060
Transport: UDP (or TCP if UDP doesn't work)
```

### Extension 9000 (Test/Customer Simulator)
```
Username: 9000
Password: test123
Server: localhost (or your server IP)
Port: 5060
Transport: UDP (or TCP if UDP doesn't work)
```

---

## 🔧 Zoiper Configuration Steps

1. **Download Zoiper**: https://www.zoiper.com/
2. **Open Zoiper** → Click "Add Account"
3. **Enter Details:**
   - Account Name: `Agent 8013` (or any name)
   - Username: `8013`
   - Password: `password123`
   - Domain/Server: `localhost`
   - Port: `5060`
4. **Click "Add"** and wait for registration
5. **Status should show "Registered"** (green)

---

## ✅ Verification Commands

### Check if softphone is registered:
```bash
docker exec dialer-asterisk asterisk -rx "sip show peers"
```

You should see your extension with status "OK" or "UNREACHABLE" (if not registered).

### Check active calls:
```bash
docker exec dialer-asterisk asterisk -rx "core show channels"
```

### View Asterisk logs:
```bash
docker logs dialer-asterisk -f
```

---

## 🧪 Quick Test

1. **Register softphone** as extension `8013`
2. **From another softphone** (or Asterisk CLI), dial `8013`
3. **Softphone should ring** - answer it
4. **You should hear audio** (or see call connected)

---

## 🐛 Troubleshooting

### Softphone won't register?
- ✅ Check firewall (port 5060 UDP/TCP)
- ✅ Verify credentials match exactly
- ✅ Try TCP instead of UDP
- ✅ Check Asterisk logs: `docker logs dialer-asterisk`

### No audio?
- ✅ Check RTP ports (10000-20000 UDP) are open
- ✅ Verify codec (ulaw/alaw)
- ✅ Check NAT settings

### Calls don't connect?
- ✅ Verify agent extension in database matches softphone extension
- ✅ Check dialplan: `docker exec dialer-asterisk asterisk -rx "dialplan show from-internal"`
- ✅ Verify AMI connection in backend logs

---

## 📞 Testing Scenarios

### Test 1: Outbound Call
- Dial `9000` from dialer interface
- Softphone registered as `9000` should ring
- Answer and verify audio

### Test 2: Inbound Call
- From softphone `9000`, dial `8013`
- Agent softphone should ring
- Incoming call modal should appear in dialer
- Answer and verify connection

### Test 3: Call Controls
- Make a call
- Test Mute/Unmute
- Test Hold/Resume
- Test Hangup

---

## 🔗 Download Links

- **Zoiper**: https://www.zoiper.com/
- **X-Lite**: https://www.counterpath.com/x-lite/
- **Linphone**: https://www.linphone.org/

---

**Need more help?** See `LOCAL_TESTING_GUIDE.md` for detailed instructions.
