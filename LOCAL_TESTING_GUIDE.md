# Local Testing Guide - Dialer with Softphone Integration

This guide will help you test your dialer system locally using a SIP softphone client.

## 📋 Prerequisites

1. **Asterisk running** (Docker or local installation)
2. **Backend server running** (FastAPI)
3. **Frontend running** (Next.js)
4. **Database running** (PostgreSQL)
5. **SIP Softphone client** (Zoiper, X-Lite, or Linphone)

---

## 🎯 Step 1: Start All Services

### 1.1 Start Asterisk (Docker)
```bash
cd "E:\Abdulrehmans work\Dialer 2"
docker-compose -f docker-compose.asterisk.yml up -d
```

### 1.2 Verify Asterisk is Running
```bash
docker ps
docker logs dialer-asterisk
```

### 1.3 Check Asterisk CLI
```bash
docker exec -it dialer-asterisk asterisk -rvvv
```

You should see Asterisk CLI. Type `sip show peers` to see registered extensions.

---

## 🔧 Step 2: Configure Asterisk for Local Testing

### 2.1 Update SIP Configuration

Edit `asterisk-config/sip.conf` to add more test extensions:

```ini
[general]
context=default
allowoverlap=no
udpbindaddr=0.0.0.0:5060
tcpenable=yes
tcpbindaddr=0.0.0.0:5060
transport=udp,tcp
rtpstart=10000
rtpend=20000

; Agent Extension 1 (for softphone)
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
qualify=yes

; Agent Extension 2 (for second softphone/testing)
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
qualify=yes

; Test Extension (for simulating customer calls)
[9000]
type=friend
host=dynamic
secret=test123
context=from-internal
canreinvite=no
disallow=all
allow=ulaw
allow=alaw
nat=force_rport,comedia
```

### 2.2 Update Extensions Configuration

Edit `asterisk-config/extensions.conf`:

```ini
[globals]
TRUNK=SIP/trunk

[from-internal]
; Agent extensions - direct dial
exten => 8013,1,NoOp(Calling Agent 8013)
exten => 8013,n,Dial(SIP/8013,30)
exten => 8013,n,Hangup()

exten => 8014,1,NoOp(Calling Agent 8014)
exten => 8014,n,Dial(SIP/8014,30)
exten => 8014,n,Hangup()

; Test extension
exten => 9000,1,NoOp(Calling Test Extension)
exten => 9000,n,Dial(SIP/9000,30)
exten => 9000,n,Hangup()

; Outbound calls - dial any number (for testing without trunk)
; Format: dial 9 + number (e.g., 9123456789)
exten => _9X.,1,NoOp(Outbound call to ${EXTEN:1})
exten => _9X.,n,Set(CALLERID(num)=${CALLERID(num)})
exten => _9X.,n,Dial(SIP/9000@from-internal,60)  ; Route to test extension for local testing
exten => _9X.,n,Hangup()

; Direct number dialing (without 9 prefix)
exten => _X.,1,NoOp(Outbound call to ${EXTEN})
exten => _X.,n,Set(CALLERID(num)=${CALLERID(num)})
; For local testing without trunk, route to test extension
exten => _X.,n,Dial(SIP/9000@from-internal,60)
exten => _X.,n,Hangup()

[from-trunk]
; Incoming calls from trunk
exten => _X.,1,NoOp(Incoming call to ${EXTEN})
exten => _X.,n,Dial(SIP/8013,20)
exten => _X.,n,Dial(SIP/8014,20)
exten => _X.,n,Hangup()
```

### 2.3 Reload Asterisk Configuration

```bash
docker exec -it dialer-asterisk asterisk -rx "sip reload"
docker exec -it dialer-asterisk asterisk -rx "dialplan reload"
```

---

## 📱 Step 3: Install and Configure Softphone

### 3.1 Recommended Softphones

**Option 1: Zoiper (Recommended)**
- Download: https://www.zoiper.com/
- Free version available
- Works on Windows, Mac, Linux, iOS, Android

**Option 2: X-Lite**
- Download: https://www.counterpath.com/x-lite/
- Free, simple interface

**Option 3: Linphone**
- Download: https://www.linphone.org/
- Open source, cross-platform

### 3.2 Configure Zoiper (Example)

1. **Open Zoiper** and click "Add Account"
2. **Account Settings:**
   - **Account Name:** Agent 8013 (or any name)
   - **Username:** `8013`
   - **Password:** `password123`
   - **Domain/Server:** `localhost` (or your server IP if testing remotely)
   - **Port:** `5060`
   - **Transport:** UDP (or TCP if UDP doesn't work)

3. **Advanced Settings (if needed):**
   - **STUN Server:** Leave empty for local testing
   - **Register:** Yes
   - **Use SRTP:** No (for local testing)

4. **Save and Register**

5. **Verify Registration:**
   - In Zoiper, you should see "Registered" status
   - In Asterisk CLI: `sip show peers` should show `8013` as registered

### 3.3 Configure Second Softphone (Optional)

For testing transfers and multi-agent scenarios:
- Install Zoiper on another device/PC or use a different softphone
- Register as extension `8014` with password `password123`

---

## 🗄️ Step 4: Configure Backend for Local Testing

### 4.1 Update Backend Configuration

**⚠️ IMPORTANT:** You MUST set `USE_MOCK_DIALER=False` to test with real Asterisk!

**Option 1: Create `.env` file (Recommended)**

Create `backend/.env` file:

```bash
# Database
DATABASE_URL=postgresql://postgres:root@localhost:5432/dialer_db

# Asterisk Configuration
USE_MOCK_DIALER=False  # ⚠️ MUST be False for real Asterisk testing!
ASTERISK_HOST=localhost
ASTERISK_AMI_PORT=5038
ASTERISK_AMI_USERNAME=admin
ASTERISK_AMI_PASSWORD=amp111
ASTERISK_CONTEXT=from-internal
ASTERISK_TRUNK=SIP/trunk

# Security
SECRET_KEY=your-secret-key-change-in-production
```

**Option 2: Edit `backend/app/core/config.py`**

Change line 22:
```python
USE_MOCK_DIALER: bool = False  # Changed from True to False
```

**After making changes, restart your backend server!**

### 4.2 Ensure Agent Exists in Database

Make sure you have an agent with extension `8013` or `8014`:

```sql
-- Check existing agents
SELECT id, username, phone_extension FROM agents;

-- If needed, create/update agent
UPDATE agents SET phone_extension = '8013' WHERE username = 'your_username';
```

Or use the Admin Dashboard to create/update agents.

---

## 🧪 Step 5: Testing Scenarios

### 5.1 Test 1: Softphone Registration

**Goal:** Verify softphone can register with Asterisk

**Steps:**
1. Configure softphone with extension `8013` and password `password123`
2. Register the softphone
3. Check registration status

**Verification:**
```bash
# In Asterisk CLI
sip show peers
sip show registry
```

**Expected Result:**
- Softphone shows "Registered" status
- Asterisk shows extension `8013` as registered
- You can see IP address and port in `sip show peers`

---

### 5.2 Test 2: Manual Dial from Dialer Interface

**Goal:** Test outbound call from dialer web interface to softphone

**Steps:**
1. **Login** to dialer web interface (http://localhost:3000)
2. **Navigate** to Dialer page
3. **Ensure** softphone is registered (extension 8013)
4. **In Manual Dial field**, enter: `9000` (test extension)
5. **Click "Dial"**

**Expected Result:**
- Softphone should ring
- Answer the call on softphone
- You should hear audio (or see call connected)
- Dialer interface shows call status as "connected"
- Call timer starts

**Troubleshooting:**
- If softphone doesn't ring, check Asterisk logs: `docker logs dialer-asterisk`
- Verify agent extension matches softphone extension
- Check AMI connection: Backend should connect to Asterisk AMI

---

### 5.3 Test 3: Call Controls (Mute, Hold, Hangup)

**Goal:** Test call control features

**Steps:**
1. **Make a call** (as in Test 2)
2. **Answer** on softphone
3. **Test Mute:**
   - Click "Mute" button in dialer interface
   - Speak into softphone - should be muted
   - Click "Unmute" - audio should resume
4. **Test Hold:**
   - Click "Hold" button
   - Audio should pause
   - Click "Resume" - audio should resume
5. **Test Hangup:**
   - Click "Hangup" button
   - Call should end on both sides

**Expected Result:**
- All controls work correctly
- Call status updates in real-time
- Softphone reflects the state changes

---

### 5.4 Test 4: Inbound Call (Simulated)

**Goal:** Test receiving calls

**Steps:**
1. **From another softphone** (or Asterisk CLI), dial extension `8013`:
   ```bash
   # In Asterisk CLI
   originate SIP/9000 extension 8013@from-internal
   ```
2. **Or from second softphone** (if configured), dial `8013`
3. **In dialer interface**, you should see incoming call modal
4. **Click "Answer"** in the modal
5. **Verify** call connects

**Expected Result:**
- Incoming call modal appears
- Answer button works
- Call connects successfully
- Call timer starts

---

### 5.5 Test 5: Call Transfer

**Goal:** Test transferring calls between agents

**Steps:**
1. **Register two softphones:**
   - Softphone 1: Extension `8013`
   - Softphone 2: Extension `8014`
2. **Make a call** from dialer (agent 8013)
3. **Answer** on softphone 1
4. **Click "Transfer"** button
5. **Enter extension:** `8014`
6. **Complete transfer**

**Expected Result:**
- Call transfers to softphone 2
- Softphone 2 rings
- When answered, call continues on softphone 2
- Softphone 1 is disconnected

---

### 5.6 Test 6: Call Recording

**Goal:** Test call recording feature

**Steps:**
1. **Make a call** and answer on softphone
2. **Click "Start Recording"** (if available in UI)
3. **Speak** for a few seconds
4. **Click "Stop Recording"**
5. **Check** recordings list

**Expected Result:**
- Recording starts/stops successfully
- Recording file is created in Asterisk
- Recording appears in recordings list

---

### 5.7 Test 7: Call History and Stats

**Goal:** Verify call data is stored correctly

**Steps:**
1. **Make several calls** (answer some, hangup some)
2. **Navigate** to "Call History" tab
3. **Check** call records
4. **Navigate** to "Stats" tab
5. **Verify** statistics update

**Expected Result:**
- All calls appear in history
- Call duration is recorded
- Stats show correct counts
- Disposition codes can be set

---

## 🔍 Step 6: Debugging and Troubleshooting

### 6.1 Check Asterisk Status

```bash
# View Asterisk logs
docker logs dialer-asterisk -f

# Check SIP peers
docker exec -it dialer-asterisk asterisk -rx "sip show peers"

# Check active channels
docker exec -it dialer-asterisk asterisk -rx "core show channels"

# Check dialplan
docker exec -it dialer-asterisk asterisk -rx "dialplan show from-internal"
```

### 6.2 Check Backend Connection

```bash
# Check if backend can connect to Asterisk AMI
# Look for connection messages in backend logs
```

### 6.3 Common Issues

**Issue 1: Softphone won't register**
- **Solution:** 
  - Check firewall (port 5060 UDP/TCP)
  - Verify SIP credentials match
  - Check Asterisk logs for errors
  - Try TCP instead of UDP

**Issue 2: Calls don't connect**
- **Solution:**
  - Verify agent extension in database matches softphone extension
  - Check dialplan configuration
  - Verify AMI connection
  - Check RTP ports (10000-20000) are open

**Issue 3: No audio**
- **Solution:**
  - Check RTP ports in firewall
  - Verify codec compatibility (ulaw/alaw)
  - Check NAT settings in sip.conf
  - Try different codec

**Issue 4: Backend can't connect to Asterisk**
- **Solution:**
  - Verify `ASTERISK_HOST` and `ASTERISK_AMI_PORT` in config
  - Check AMI credentials in `manager.conf`
  - Ensure Asterisk container is running
  - Check network connectivity

---

## 📊 Step 7: Testing Checklist

Use this checklist to ensure all features work:

- [ ] Softphone registers successfully
- [ ] Outbound call from dialer interface works
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
- [ ] Real-time updates via WebSocket work
- [ ] Multiple agents can work simultaneously

---

## 🚀 Step 8: Next Steps After Local Testing

Once local testing is successful:

1. **Deploy to server** (if not already done)
2. **Configure SIP trunk** for real phone calls
3. **Set up DID** for inbound calls
4. **Test with real phone numbers**
5. **Configure firewall** properly
6. **Set up monitoring** and logging
7. **Load testing** with multiple agents

---

## 📝 Quick Reference

### Softphone Configuration (Zoiper)
```
Username: 8013
Password: password123
Server: localhost (or server IP)
Port: 5060
Transport: UDP
```

### Asterisk Commands
```bash
# Reload SIP
sip reload

# Reload dialplan
dialplan reload

# Show registered peers
sip show peers

# Show active channels
core show channels

# Originate test call
originate SIP/9000 extension 8013@from-internal
```

### Backend Configuration
```python
USE_MOCK_DIALER=False
ASTERISK_HOST=localhost
ASTERISK_AMI_PORT=5038
ASTERISK_AMI_USERNAME=admin
ASTERISK_AMI_PASSWORD=amp111
```

---

## 🎉 Success Indicators

You'll know everything is working when:
- ✅ Softphone shows "Registered"
- ✅ You can make calls from dialer interface
- ✅ Calls connect and you hear audio
- ✅ All call controls work
- ✅ Call data is saved in database
- ✅ Real-time updates work in UI

Happy Testing! 🚀
