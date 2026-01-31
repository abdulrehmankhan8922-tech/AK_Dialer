# Asterisk Testing Guide - Inbound & Outbound Calls

## ✅ Prerequisites Checklist

Before testing, ensure:

- [ ] Asterisk is running: `sudo systemctl status asterisk`
- [ ] Backend is running: `sudo systemctl status dialer-backend`
- [ ] Frontend is running: `sudo systemctl status dialer-frontend`
- [ ] Softphone registered (extension 8013 or 8014)
- [ ] Agent exists in database with matching extension
- [ ] Firewall allows ports: 5060 (SIP), 5038 (AMI), 8000 (Backend), 3000 (Frontend)

---

## 🧪 Test 1: Verify Setup

### 1.1 Check Asterisk Status
```bash
# Check Asterisk is running
sudo systemctl status asterisk

# Check PJSIP endpoints
sudo asterisk -rx "pjsip show endpoints"

# Check registered contacts
sudo asterisk -rx "pjsip show contacts"

# Check manager interface
sudo asterisk -rx "manager show connected"
```

### 1.2 Check Backend Connection
```bash
# Check backend logs for AMI connection
sudo journalctl -u dialer-backend -n 50 | grep -i "AMI\|asterisk"

# Should see: "Connected to Asterisk AMI" or "AMI event listener start initiated"
```

### 1.3 Verify Softphone Registration
```bash
# Check if softphone is registered
sudo asterisk -rx "pjsip show contacts"

# Should show your extension (8013 or 8014) with status "Avail"
```

---

## 📞 Test 2: Outbound Call from Dialer

### Setup:
1. **Login to Frontend**: http://163.245.208.168:3000
2. **Use credentials**: 
   - Username: `8013` (or your agent extension)
   - Password: `password` (or your agent password)
3. **Ensure softphone is registered** as extension 8013

### Steps:
1. Open dialer page
2. In "Manual Dial" field, enter: `9000` (test extension)
3. Click "Dial" button
4. **Expected Result:**
   - Softphone registered as `9000` should ring
   - Call status shows "Ringing" then "Connected"
   - Call timer starts
   - You can hear audio

### Verify in Asterisk:
```bash
# Watch active channels
sudo asterisk -rx "core show channels"

# Check call in progress
# Should show channels for both agent and customer
```

---

## 📞 Test 3: Inbound Call to Agent

### Setup:
1. Register **two softphones**:
   - Softphone 1: Extension `8013` (Agent)
   - Softphone 2: Extension `9000` (Customer/Test)

### Steps:
1. **From softphone 9000**, dial `8013`
2. **Expected Result:**
   - Agent softphone (`8013`) rings
   - Dialer interface shows **incoming call modal**
   - Modal shows caller information
   - Click "Answer" button
   - Call connects
   - Call timer starts

### Alternative: Test from Asterisk CLI
```bash
# Connect to Asterisk CLI
sudo asterisk -rvvv

# Originate call to agent
originate PJSIP/9000 extension 8013@from-internal

# Agent softphone should ring
# Dialer should show incoming call
```

---

## 🎛️ Test 4: Call Controls

### During an Active Call:

#### 4.1 Mute/Unmute
- Click "Mute" button
- **Expected**: Audio muted, button changes to "Unmute"
- Click "Unmute"
- **Expected**: Audio resumes

#### 4.2 Hold/Resume
- Click "Hold" button
- **Expected**: Call on hold, button changes to "Resume"
- Click "Resume"
- **Expected**: Call resumes

#### 4.3 Hangup
- Click "Hangup" button
- **Expected**: Call ends, status updates to "Ended"

### Verify in Asterisk:
```bash
# Check channels during call
sudo asterisk -rx "core show channels"

# After hangup, channels should be cleared
```

---

## 🔄 Test 5: Call Transfer

### Setup:
- Register two agent softphones:
  - Agent 1: Extension `8013`
  - Agent 2: Extension `8014`
- Make a call from Agent 1

### Steps:
1. Make outbound call from Agent 1 (dial `9000`)
2. Answer the call
3. Click "Transfer" button
4. Enter target extension: `8014`
5. Complete transfer
6. **Expected Result:**
   - Call transfers to Agent 2
   - Agent 2's softphone rings
   - When Agent 2 answers, call continues
   - Agent 1 is disconnected

---

## 📊 Test 6: Call History & Stats

### Steps:
1. Make several calls (answer some, hangup some)
2. Navigate to "Call History" tab
3. **Expected Result:**
   - All calls appear in history
   - Call duration is recorded
   - Call status is correct
   - Phone numbers are saved

4. Navigate to "Stats" tab
5. **Expected Result:**
   - Total calls count updates
   - Inbound/outbound counts correct
   - Call duration statistics shown

---

## 🎙️ Test 7: Call Recording (If Implemented)

### Steps:
1. Make a call
2. Click "Start Recording" (if available)
3. Speak for a few seconds
4. Click "Stop Recording"
5. **Expected Result:**
   - Recording starts/stops successfully
   - Recording appears in recordings list

### Verify Recording File:
```bash
# Check if recording file was created
ls -la /var/spool/asterisk/monitor/

# Should see .wav files with call timestamps
```

---

## 📝 Test 8: Customer Information Form

### Steps:
1. Make a call
2. Fill out customer information form:
   - Name, Phone, Email, Address, etc.
3. Click "Save Customer Information"
4. **Expected Result:**
   - Success message appears
   - Contact is saved to database
   - Contact appears in contacts list

---

## 🔍 Test 9: Disposition Codes

### Steps:
1. Make a call
2. After call ends (or during call)
3. Select a disposition code (e.g., "Answered", "No Answer", "Busy")
4. Add notes (optional)
5. Click "Save Disposition"
6. **Expected Result:**
   - Disposition is saved
   - Appears in call history
   - Stats update accordingly

---

## 🐛 Troubleshooting

### Issue: Calls Don't Connect

**Check:**
```bash
# 1. Verify softphone registered
sudo asterisk -rx "pjsip show contacts"

# 2. Check dialplan
sudo asterisk -rx "dialplan show from-internal"

# 3. Check active channels
sudo asterisk -rx "core show channels"

# 4. Check backend logs
sudo journalctl -u dialer-backend -f

# 5. Check Asterisk logs
sudo tail -f /var/log/asterisk/full
```

**Common Fixes:**
- Ensure agent extension in database matches softphone extension
- Verify dialplan uses `PJSIP/` not `SIP/`
- Check firewall allows RTP ports (10000-20000 UDP)
- Verify AMI connection in backend logs

### Issue: No Audio

**Check:**
```bash
# 1. Check RTP ports
sudo netstat -ulnp | grep -E "(10000|10001|10002)"

# 2. Check firewall
sudo ufw status | grep 10000

# 3. Verify codecs
sudo asterisk -rx "pjsip show endpoint 8013"
```

**Fixes:**
- Open RTP ports: `sudo ufw allow 10000:20000/udp`
- Check codec compatibility (ulaw/alaw)
- Verify NAT settings in PJSIP config

### Issue: Backend Can't Connect to Asterisk

**Check:**
```bash
# 1. Verify AMI is accessible
telnet 163.245.208.168 5038

# 2. Check manager.conf
sudo cat /etc/asterisk/manager.conf

# 3. Check backend logs
sudo journalctl -u dialer-backend | grep -i "AMI\|asterisk"
```

**Fixes:**
- Verify `ASTERISK_HOST` in backend service file
- Check manager.conf allows connections
- Verify firewall allows port 5038

---

## ✅ Quick Testing Checklist

Use this checklist for complete testing:

- [ ] Softphone registered successfully
- [ ] Outbound call from dialer works
- [ ] Inbound call to agent works
- [ ] Call connects and audio works
- [ ] Mute/Unmute works
- [ ] Hold/Resume works
- [ ] Hangup works
- [ ] Transfer works
- [ ] Call recording works (if implemented)
- [ ] Call history saves correctly
- [ ] Stats update correctly
- [ ] Disposition codes work
- [ ] Customer information form works
- [ ] Real-time updates via WebSocket work

---

## 🚀 Quick Start Testing

**Minimal test (5 minutes):**

1. **Register softphone** as extension `8013`
2. **Login** to dialer: http://163.245.208.168:3000
3. **Dial** `9000` from dialer interface
4. **Answer** on softphone registered as `9000`
5. **Test controls**: Mute, Hold, Hangup
6. **Check history**: Verify call appears

If all these work, your basic setup is functional!

---

## 📞 Testing with Real SIP Trunk

Once basic testing works, configure your SIP trunk:

1. **Add trunk configuration** in `/etc/asterisk/pjsip.conf`:
```ini
[trunk]
type=endpoint
context=from-internal
disallow=all
allow=ulaw
allow=alaw
aors=trunk
auth=trunk

[trunk]
type=auth
auth_type=userpass
password=your_trunk_password
username=your_trunk_username

[trunk]
type=aor
contact=sip:your_provider.com:5060
```

2. **Update dialplan** in `/etc/asterisk/extensions.conf`:
```ini
exten => _X.,1,NoOp(Outbound call to ${EXTEN})
exten => _X.,n,Dial(PJSIP/trunk/${EXTEN},60)
exten => _X.,n,Hangup()
```

3. **Reload**:
```bash
sudo asterisk -rx "pjsip reload"
sudo asterisk -rx "dialplan reload"
```

4. **Test with real number**: Dial a real phone number from dialer

---

**Happy Testing! 🎉**
