# Dialer System - Complete Testing Guide

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Test Environment Setup](#test-environment-setup)
3. [Test Cases Overview](#test-cases-overview)
4. [Detailed Test Cases](#detailed-test-cases)
5. [Expected Results](#expected-results)
6. [Troubleshooting](#troubleshooting)

---

## 🔧 Prerequisites

### Required Software:
- ✅ PostgreSQL database (running and configured)
- ✅ Asterisk installed and running (for real telephony testing)
- ✅ SIP phone/softphone (Zoiper, X-Lite, Linphone) for agent
- ✅ SIP trunk configured (for outbound calls - can use test numbers)
- ✅ Backend server running (FastAPI)
- ✅ Frontend server running (Next.js)
- ✅ Database populated with seed data

### Test Accounts:
- **Admin User:** username: `admin`, password: `admin`
- **Test Agent:** username: `agent1`, password: `agent1` (or create new ones)

---

## 🚀 Test Environment Setup

### Step 1: Database Setup
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE dialer_db;

# Run setup script
\c dialer_db
\i database_setup.sql
```

### Step 2: Backend Configuration
Check `backend/app/core/config.py`:
- Database connection string
- Asterisk AMI credentials (host, port, username, password)
- Asterisk trunk name
- `USE_MOCK_DIALER = False` (for real testing)

### Step 3: Start Services
```bash
# Terminal 1: Start Backend
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: Start Frontend
cd frontend
npm run dev
```

### Step 4: Asterisk Setup
Ensure Asterisk is configured:
- AMI enabled (manager.conf)
- SIP trunk configured (sip.conf)
- Dialplan configured (extensions.conf)
- Agent extensions registered

---

## 📊 Test Cases Overview

### Category 1: Authentication & Authorization
- [ ] Test Case 1.1: Admin Login
- [ ] Test Case 1.2: Agent Login
- [ ] Test Case 1.3: Logout
- [ ] Test Case 1.4: Invalid Credentials

### Category 2: Admin Dashboard
- [ ] Test Case 2.1: View Dashboard
- [ ] Test Case 2.2: Create Agent
- [ ] Test Case 2.3: Edit Agent
- [ ] Test Case 2.4: Search Agents
- [ ] Test Case 2.5: View Statistics

### Category 3: Outbound Calls
- [ ] Test Case 3.1: Manual Dial
- [ ] Test Case 3.2: Call Status Updates
- [ ] Test Case 3.3: Mute/Unmute
- [ ] Test Case 3.4: Hold/Resume
- [ ] Test Case 3.5: Transfer Call
- [ ] Test Case 3.6: Park Call
- [ ] Test Case 3.7: Hangup Call

### Category 4: Inbound Calls
- [ ] Test Case 4.1: Receive Incoming Call
- [ ] Test Case 4.2: Answer Incoming Call
- [ ] Test Case 4.3: Reject Incoming Call

### Category 5: Call Recording
- [ ] Test Case 5.1: Start Recording
- [ ] Test Case 5.2: Stop Recording
- [ ] Test Case 5.3: View Recording List

### Category 6: Statistics & Reports
- [ ] Test Case 6.1: View Today's Stats
- [ ] Test Case 6.2: View Call History
- [ ] Test Case 6.3: View Admin Statistics

### Category 7: Contact Management
- [ ] Test Case 7.1: View Contacts
- [ ] Test Case 7.2: Create Contact
- [ ] Test Case 7.3: Update Contact

### Category 8: CDR & Quality Metrics
- [ ] Test Case 8.1: CDR Event Processing
- [ ] Test Case 8.2: Call Quality Metrics Collection

---

## 📝 Detailed Test Cases

### **Category 1: Authentication & Authorization**

#### Test Case 1.1: Admin Login
**Objective:** Verify admin can log in and access admin dashboard

**Steps:**
1. Open browser: `http://localhost:3000/login`
2. Enter username: `admin`
3. Enter password: `admin`
4. Click "Login" button

**Expected Results:**
- ✅ Redirects to `/admin` dashboard
- ✅ Admin dashboard loads with summary cards
- ✅ Agents table visible
- ✅ No redirect to `/dialer`

**Pass/Fail:** ☐ Pass ☐ Fail

---

#### Test Case 1.2: Agent Login
**Objective:** Verify agent can log in and access dialer

**Steps:**
1. Open browser: `http://localhost:3000/login`
2. Enter username: `agent1` (or any agent username)
3. Enter password: `agent1` (or corresponding password)
4. Click "Login" button

**Expected Results:**
- ✅ Redirects to `/dialer` page
- ✅ Dialer interface loads
- ✅ Call controls visible
- ✅ Stats dashboard visible
- ✅ No redirect to `/admin`

**Pass/Fail:** ☐ Pass ☐ Fail

---

#### Test Case 1.3: Logout
**Objective:** Verify logout functionality

**Steps:**
1. Logged in as any user (admin or agent)
2. Click "Logout" button in topbar
3. Confirm logout

**Expected Results:**
- ✅ Redirects to `/login` page
- ✅ Token removed from localStorage
- ✅ Cannot access protected routes
- ✅ Must login again to access

**Pass/Fail:** ☐ Pass ☐ Fail

---

#### Test Case 1.4: Invalid Credentials
**Objective:** Verify error handling for invalid login

**Steps:**
1. Go to login page
2. Enter invalid username: `wronguser`
3. Enter invalid password: `wrongpass`
4. Click "Login"

**Expected Results:**
- ✅ Error message displayed
- ✅ Remains on login page
- ✅ No redirect occurs
- ✅ Error message is clear and helpful

**Pass/Fail:** ☐ Pass ☐ Fail

---

### **Category 2: Admin Dashboard**

#### Test Case 2.1: View Dashboard
**Objective:** Verify admin dashboard displays correctly

**Steps:**
1. Login as admin
2. Navigate to admin dashboard (should auto-redirect)

**Expected Results:**
- ✅ Summary cards visible (Total Agents, Total Calls, Answer Rate, Abandoned Calls)
- ✅ Agents table visible below cards
- ✅ Tabs visible (Overview, Performance Graphs)
- ✅ Statistics are accurate
- ✅ Dark mode toggle works

**Pass/Fail:** ☐ Pass ☐ Fail

---

#### Test Case 2.2: Create Agent
**Objective:** Verify admin can create new agents

**Steps:**
1. Login as admin
2. Click "Create Agent" button
3. Fill in form:
   - Username: `testagent`
   - Full Name: `Test Agent`
   - Phone Extension: `1001`
   - Password: `testpass123`
   - Is Admin: (unchecked)
4. Click "Create Agent"

**Expected Results:**
- ✅ Modal opens with form
- ✅ Agent created successfully
- ✅ Agent appears in agents table
- ✅ Can login with new credentials
- ✅ No duplicate username/extension errors

**Pass/Fail:** ☐ Pass ☐ Fail

---

#### Test Case 2.3: Edit Agent
**Objective:** Verify admin can edit existing agents

**Steps:**
1. Login as admin
2. Find agent in table
3. Click "Edit" button
4. Change Full Name to: `Updated Name`
5. Click "Save Changes"

**Expected Results:**
- ✅ Modal opens with current data
- ✅ Changes saved successfully
- ✅ Updated data visible in table
- ✅ Password field optional (leave blank to keep current)

**Pass/Fail:** ☐ Pass ☐ Fail

---

#### Test Case 2.4: Search Agents
**Objective:** Verify agent search functionality

**Steps:**
1. Login as admin
2. Enter search query in search box (try: username, name, extension)
3. Observe filtered results

**Expected Results:**
- ✅ Search filters in real-time
- ✅ Searches by username
- ✅ Searches by full name
- ✅ Searches by extension
- ✅ Case-insensitive search
- ✅ Empty search shows all agents

**Pass/Fail:** ☐ Pass ☐ Fail

---

#### Test Case 2.5: View Statistics
**Objective:** Verify statistics display correctly

**Steps:**
1. Login as admin
2. View Overview tab statistics
3. Click "Performance Graphs" tab

**Expected Results:**
- ✅ Summary cards show accurate numbers
- ✅ Agent performance table visible
- ✅ Performance bar chart visible
- ✅ All statistics update correctly
- ✅ No errors in console

**Pass/Fail:** ☐ Pass ☐ Fail

---

### **Category 3: Outbound Calls**

#### Test Case 3.1: Manual Dial
**Objective:** Verify manual dialing functionality

**Prerequisites:**
- Agent logged in
- SIP phone/softphone registered
- Asterisk configured for outbound calls

**Steps:**
1. Login as agent
2. Ensure agent's SIP phone is registered
3. In "Manual Dial" input, enter phone number (e.g., `1234567890`)
4. Click "Dial" button
5. Observe call initiation

**Expected Results:**
- ✅ Call initiated in database
- ✅ Agent's phone rings first
- ✅ After agent answers, customer is dialed
- ✅ Call status updates to "ringing" then "answered"
- ✅ Call timer starts
- ✅ Customer info form becomes available
- ✅ Real-time status updates via WebSocket

**Pass/Fail:** ☐ Pass ☐ Fail

**Notes:**
- If using mock dialer, call will simulate
- Real Asterisk requires proper trunk configuration

---

#### Test Case 3.2: Call Status Updates
**Objective:** Verify real-time call status updates

**Steps:**
1. Initiate a call (Test Case 3.1)
2. Observe call status changes:
   - DIALING → RINGING → ANSWERED → CONNECTED
3. Check WebSocket events in browser console

**Expected Results:**
- ✅ Status updates automatically
- ✅ UI reflects current status
- ✅ WebSocket events received
- ✅ Call timer updates
- ✅ Status displayed correctly

**Pass/Fail:** ☐ Pass ☐ Fail

---

#### Test Case 3.3: Mute/Unmute
**Objective:** Verify mute functionality during active call

**Prerequisites:**
- Active call in progress

**Steps:**
1. Ensure call is active (status: ANSWERED or CONNECTED)
2. Click "Mute" button
3. Verify mute state
4. Click "Unmute" button (or "Mute" button again)

**Expected Results:**
- ✅ Mute button changes to orange/highlighted when muted
- ✅ Button text changes to "Unmute"
- ✅ Call is actually muted in Asterisk
- ✅ Database `is_muted` field updates
- ✅ Unmute works correctly
- ✅ WebSocket update sent

**Pass/Fail:** ☐ Pass ☐ Fail

---

#### Test Case 3.4: Hold/Resume
**Objective:** Verify hold functionality during active call

**Prerequisites:**
- Active call in progress

**Steps:**
1. Ensure call is active
2. Click "Hold" button
3. Verify hold state
4. Click "Resume" button (or "Hold" button again)

**Expected Results:**
- ✅ Hold button changes to yellow/highlighted when on hold
- ✅ Button text changes to "Resume"
- ✅ Call is actually on hold in Asterisk
- ✅ Database `is_on_hold` field updates
- ✅ Resume works correctly
- ✅ WebSocket update sent

**Pass/Fail:** ☐ Pass ☐ Fail

---

#### Test Case 3.5: Transfer Call
**Objective:** Verify call transfer functionality

**Prerequisites:**
- Active call in progress
- Another agent extension available

**Steps:**
1. Ensure call is active
2. Click "Transfer" button
3. Enter target extension (e.g., `1002`)
4. Click "Transfer" in modal

**Expected Results:**
- ✅ Transfer modal opens
- ✅ Extension input accepts value
- ✅ Transfer succeeds
- ✅ Call transferred to target extension
- ✅ Current call ends
- ✅ Call record updated

**Pass/Fail:** ☐ Pass ☐ Fail

---

#### Test Case 3.6: Park Call
**Objective:** Verify call parking functionality

**Prerequisites:**
- Active call in progress

**Steps:**
1. Ensure call is active
2. Click "Park" button
3. Verify call is parked

**Expected Results:**
- ✅ Park action succeeds
- ✅ Call is parked in Asterisk
- ✅ Call record updated
- ✅ No errors occur

**Pass/Fail:** ☐ Pass ☐ Fail

---

#### Test Case 3.7: Hangup Call
**Objective:** Verify call hangup functionality

**Prerequisites:**
- Active call in progress

**Steps:**
1. Ensure call is active
2. Click "Hangup Call" button (red button)
3. Confirm hangup

**Expected Results:**
- ✅ Call ends immediately
- ✅ Call status updates to "ended"
- ✅ End time recorded
- ✅ Duration calculated
- ✅ Call timer stops
- ✅ Statistics update
- ✅ Customer info form cleared
- ✅ No errors occur

**Pass/Fail:** ☐ Pass ☐ Fail

---

### **Category 4: Inbound Calls**

#### Test Case 4.1: Receive Incoming Call
**Objective:** Verify incoming call notification

**Prerequisites:**
- Agent logged in
- Asterisk configured for inbound calls
- Test number to call

**Steps:**
1. Agent logged in and available
2. Call the configured inbound number
3. Observe incoming call modal

**Expected Results:**
- ✅ Incoming call modal appears
- ✅ Phone number displayed
- ✅ Contact info displayed (if contact exists)
- ✅ Answer and Reject buttons visible
- ✅ Modal is prominent (animation, border)
- ✅ WebSocket event received

**Pass/Fail:** ☐ Pass ☐ Fail

---

#### Test Case 4.2: Answer Incoming Call
**Objective:** Verify answering incoming calls

**Steps:**
1. Receive incoming call (Test Case 4.1)
2. Click "Answer" button
3. Verify call is answered

**Expected Results:**
- ✅ Answer action succeeds
- ✅ Call status updates to "answered"
- ✅ Call becomes active
- ✅ Modal closes
- ✅ Call controls available
- ✅ Call timer starts
- ✅ Agent assigned to call

**Pass/Fail:** ☐ Pass ☐ Fail

---

#### Test Case 4.3: Reject Incoming Call
**Objective:** Verify rejecting incoming calls

**Steps:**
1. Receive incoming call (Test Case 4.1)
2. Click "Reject" button
3. Verify call is rejected

**Expected Results:**
- ✅ Reject action succeeds
- ✅ Call status updates to "ended"
- ✅ Call is hung up
- ✅ Modal closes
- ✅ Call record created with disposition
- ✅ Statistics update

**Pass/Fail:** ☐ Pass ☐ Fail

---

### **Category 5: Call Recording**

#### Test Case 5.1: Start Recording
**Objective:** Verify call recording starts correctly

**Prerequisites:**
- Active call in progress

**Steps:**
1. Ensure call is active (answered)
2. Use API endpoint or frontend (if UI exists):
   ```
   POST /api/calls/{call_id}/recording/start
   ```
3. Verify recording starts

**Expected Results:**
- ✅ Recording starts successfully
- ✅ CallRecording record created in database
- ✅ File path stored
- ✅ Recording active in Asterisk
- ✅ WebSocket notification sent
- ✅ No errors occur

**Pass/Fail:** ☐ Pass ☐ Fail

**API Test:**
```bash
curl -X POST "http://localhost:8000/api/calls/1/recording/start" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

---

#### Test Case 5.2: Stop Recording
**Objective:** Verify call recording stops correctly

**Steps:**
1. Recording is active (Test Case 5.1)
2. Use API endpoint:
   ```
   POST /api/calls/{call_id}/recording/stop
   ```
3. Verify recording stops

**Expected Results:**
- ✅ Recording stops successfully
- ✅ Recording record updated
- ✅ File path available
- ✅ Recording stopped in Asterisk
- ✅ WebSocket notification sent

**Pass/Fail:** ☐ Pass ☐ Fail

---

#### Test Case 5.3: View Recording List
**Objective:** Verify recording list retrieval

**Steps:**
1. Call has recordings (from Test Case 5.1)
2. Use API endpoint:
   ```
   GET /api/calls/{call_id}/recordings
   ```
3. Verify recordings list

**Expected Results:**
- ✅ Recordings list returned
- ✅ All recordings for call visible
- ✅ File paths included
- ✅ Metadata included (duration, size, created_at)

**Pass/Fail:** ☐ Pass ☐ Fail

---

### **Category 6: Statistics & Reports**

#### Test Case 6.1: View Today's Stats
**Objective:** Verify statistics display for agent

**Steps:**
1. Login as agent
2. View "Today's Statistics" section
3. Verify stats accuracy

**Expected Results:**
- ✅ Inbound calls count accurate
- ✅ Outbound calls count accurate
- ✅ Total calls accurate
- ✅ Login time displayed
- ✅ Break time displayed
- ✅ Stats update in real-time
- ✅ No calculation errors

**Pass/Fail:** ☐ Pass ☐ Fail

---

#### Test Case 6.2: View Call History
**Objective:** Verify call history display

**Steps:**
1. Login as agent
2. Click "History" tab
3. View call history

**Expected Results:**
- ✅ Call history table visible
- ✅ Calls listed with details
- ✅ Filter options work (All, Today, Outbound, Inbound)
- ✅ Phone numbers displayed
- ✅ Status displayed
- ✅ Duration displayed
- ✅ Timestamps accurate

**Pass/Fail:** ☐ Pass ☐ Fail

---

#### Test Case 6.3: View Admin Statistics
**Objective:** Verify admin statistics

**Steps:**
1. Login as admin
2. View Overview tab
3. Click Performance Graphs tab

**Expected Results:**
- ✅ Summary statistics accurate
- ✅ All agents listed
- ✅ Performance metrics correct
- ✅ Bar charts display correctly
- ✅ Answer rates calculated correctly
- ✅ Average durations accurate

**Pass/Fail:** ☐ Fail

---

### **Category 7: Contact Management**

#### Test Case 7.1: View Contacts
**Objective:** Verify contacts list display

**Steps:**
1. Login as agent (or admin)
2. Navigate to Contacts page
3. View contacts list

**Expected Results:**
- ✅ Contacts table visible
- ✅ Contacts filtered by campaign (for agents)
- ✅ All contacts visible (for admin)
- ✅ Contact details displayed
- ✅ Search/filter works (if implemented)

**Pass/Fail:** ☐ Pass ☐ Fail

---

#### Test Case 7.2: Create Contact
**Objective:** Verify contact creation

**Steps:**
1. Go to Contacts page
2. Click "Create Contact" or "+" button
3. Fill in contact form:
   - Name: `Test Contact`
   - Phone: `1234567890`
   - Email: `test@example.com`
   - Campaign: Select campaign
   - Other fields (optional)
4. Click "Create" or "Save"

**Expected Results:**
- ✅ Modal opens with form
- ✅ Contact created successfully
- ✅ Contact appears in list
- ✅ Validation works (required fields)
- ✅ Campaign assignment correct

**Pass/Fail:** ☐ Pass ☐ Fail

---

#### Test Case 7.3: Update Contact
**Objective:** Verify contact update

**Steps:**
1. Find contact in list
2. Click "Edit" button
3. Update contact information
4. Save changes

**Expected Results:**
- ✅ Edit form opens with current data
- ✅ Changes saved successfully
- ✅ Updated data visible in list
- ✅ No data loss

**Pass/Fail:** ☐ Pass ☐ Fail

---

### **Category 8: CDR & Quality Metrics**

#### Test Case 8.1: CDR Event Processing
**Objective:** Verify CDR events are processed correctly

**Prerequisites:**
- Active call completed
- Asterisk CDR enabled
- AMI event listener running

**Steps:**
1. Complete a call (dial, answer, hangup)
2. Check database for CDR updates
3. Verify call record updated

**Expected Results:**
- ✅ CDR event received from Asterisk
- ✅ Call record updated with duration
- ✅ Billsec updated
- ✅ Disposition set correctly
- ✅ End time recorded
- ✅ Status synchronized

**Pass/Fail:** ☐ Pass ☐ Fail

**Database Check:**
```sql
SELECT id, phone_number, duration, billsec, disposition, end_time 
FROM calls 
WHERE id = <call_id>;
```

---

#### Test Case 8.2: Call Quality Metrics Collection
**Objective:** Verify quality metrics are collected

**Prerequisites:**
- Active call with RTCP enabled in Asterisk
- Quality metrics variables available

**Steps:**
1. Make a call with RTCP enabled
2. Check database for quality metrics
3. Verify metrics stored

**Expected Results:**
- ✅ Quality metrics record created
- ✅ Jitter recorded (if available)
- ✅ Packet loss recorded (if available)
- ✅ MOS score recorded (if available)
- ✅ Metrics linked to call

**Pass/Fail:** ☐ Pass ☐ Fail

**Database Check:**
```sql
SELECT * FROM call_quality_metrics WHERE call_id = <call_id>;
```

---

## ✅ Test Results Summary

**Test Date:** _______________

**Tested By:** _______________

### Summary:
- **Total Test Cases:** 28
- **Passed:** ___
- **Failed:** ___
- **Blocked:** ___
- **Pass Rate:** ___%

### Critical Issues Found:
1. ________________________________
2. ________________________________
3. ________________________________

### Minor Issues Found:
1. ________________________________
2. ________________________________
3. ________________________________

---

## 🔍 Troubleshooting

### Common Issues:

#### 1. Calls Not Connecting
**Problem:** Calls initiate but don't connect

**Solutions:**
- Check Asterisk SIP trunk configuration
- Verify phone numbers are valid
- Check Asterisk logs: `asterisk -rvvv`
- Verify dialplan is correct
- Check firewall/network connectivity

#### 2. WebSocket Not Working
**Problem:** Real-time updates not appearing

**Solutions:**
- Check WebSocket connection in browser console
- Verify backend WebSocket endpoint is accessible
- Check CORS configuration
- Verify token is valid
- Check network connectivity

#### 3. AMI Connection Failed
**Problem:** AMI event listener not connecting

**Solutions:**
- Verify Asterisk AMI is enabled (`manager.conf`)
- Check AMI credentials in config
- Verify firewall allows AMI port (default: 5038)
- Check Asterisk logs for AMI errors
- Test AMI connection manually: `telnet localhost 5038`

#### 4. Database Errors
**Problem:** Database connection or query errors

**Solutions:**
- Verify PostgreSQL is running
- Check database connection string
- Verify database schema is correct
- Run database_setup.sql again if needed
- Check database logs

#### 5. Frontend Not Loading
**Problem:** Frontend page blank or errors

**Solutions:**
- Check browser console for errors
- Verify backend API is accessible
- Check CORS configuration
- Clear browser cache
- Check Next.js build output

---

## 📞 Support & Additional Resources

- **Asterisk Documentation:** https://docs.asterisk.org/
- **FastAPI Documentation:** https://fastapi.tiangolo.com/
- **Next.js Documentation:** https://nextjs.org/docs

---

## 📝 Notes

- This testing guide assumes Asterisk is properly configured
- Mock dialer mode can be used for testing without Asterisk
- Some features require specific Asterisk configuration
- Performance testing should be done separately
- Load testing requires multiple agents and calls

---

**Last Updated:** 2024
**Version:** 1.0
