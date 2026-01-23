# Asterisk Integration - Implementation Plan & Changes Required

## 📊 Current Completion Assessment

Based on codebase analysis, here's what you have:

### ✅ Completed (~60-65%)

**Database:**
- ✅ Complete schema with agents, campaigns, contacts, calls, agent_sessions
- ✅ All required enums (CallStatus, CallDirection, AgentStatus, etc.)
- ✅ Proper relationships and indexes

**Backend:**
- ✅ FastAPI structure with routes (auth, agents, calls, campaigns, contacts, stats, admin)
- ✅ Basic AsteriskService with AMI connection
- ✅ DialerService that uses AsteriskService
- ✅ WebSocket manager and endpoint
- ✅ Call routes (dial, hangup, transfer, park, disposition)
- ✅ Models and schemas for all entities
- ✅ Authentication and authorization

**Frontend:**
- ✅ Next.js app with dialer page
- ✅ Call controls (dial, hangup, transfer, park)
- ✅ Customer info form
- ✅ Stats dashboard
- ✅ Call history
- ✅ WebSocket client connection
- ✅ Admin portal, contacts page, reports

### ⚠️ Needs Enhancement (~35-40%)

**Backend Issues:**
- ❌ No AMI event listener (critical for real-time updates)
- ❌ No channel tracking (call_unique_id to Asterisk channel mapping)
- ❌ Basic call origination (needs proper agent-first bridging)
- ❌ No inbound call handling
- ❌ No CDR (Call Detail Records) integration
- ❌ No mute/hold functionality
- ❌ Recording path not stored properly
- ❌ AMI connection not persistent/reconnectable
- ❌ No event routing to WebSocket

**Database Missing:**
- ❌ Call recordings table (optional but recommended)
- ❌ CDR fields could be enhanced

**Frontend Missing:**
- ❌ Mute/Hold buttons
- ❌ Incoming call popup/handling
- ❌ WebRTC for browser calling (future)
- ❌ Better real-time call status display

---

## 📋 Required Changes Breakdown

### 🔴 PHASE 1: Critical Asterisk Integration (Must Have)

#### **Backend Changes**

1. **AMI Event Listener Service** (NEW)
   - Persistent AMI connection with auto-reconnect
   - Event handler for: Newchannel, Newstate, Hangup, Bridge, Newexten, etc.
   - Route events to WebSocket manager
   - Track channels and map to call_unique_id

2. **Enhanced AsteriskService** (MODIFY)
   - Improve AMI connection to be persistent
   - Add event subscription (Action: Events)
   - Better error handling and reconnection logic
   - Channel tracking dictionary

3. **Channel Tracking** (NEW)
   - Service to map call_unique_id ↔ Asterisk channels
   - Track both agent and customer channels
   - Update call status based on channel states

4. **Call Bridging Logic** (MODIFY)
   - Fix originate to call agent first, then customer
   - Use Dial with two channels (agent + customer)
   - Proper bridge handling

5. **WebSocket Event Broadcasting** (ENHANCE)
   - Route AMI events to WebSocket
   - Send call status updates in real-time
   - Send channel state changes

6. **CDR Integration** (NEW)
   - AMI CDR events or SQL CDR queries
   - Parse and store call details (duration, billsec, etc.)
   - Update call records from CDR

#### **Database Changes**

1. **Calls Table Enhancement** (MODIFY)
   - Add `agent_channel` VARCHAR(255)
   - Add `customer_channel` VARCHAR(255)
   - Add `bridge_unique_id` VARCHAR(255)
   - Ensure `recording_path` is properly used

2. **Optional: Call Recordings Table** (NEW - Future)
   ```sql
   CREATE TABLE call_recordings (
       id SERIAL PRIMARY KEY,
       call_id INTEGER REFERENCES calls(id),
       file_path VARCHAR(500) NOT NULL,
       file_size INTEGER,
       duration INTEGER,
       created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
   );
   ```

#### **Frontend Changes**

1. **Real-time Call Status** (ENHANCE)
   - Listen for AMI events via WebSocket
   - Update call status (ringing → connected → answered)
   - Show live call state changes

2. **Incoming Call Handler** (NEW)
   - Popup modal for incoming calls
   - Accept/Reject buttons
   - Customer info lookup and display

---

### 🟡 PHASE 2: Enhanced Features (Should Have)

#### **Backend Changes**

1. **Mute/Hold Functionality** (NEW)
   - AMI Mute action
   - AMI Hold/Unhold via Redirect
   - API endpoints: `/api/calls/{call_id}/mute`, `/api/calls/{call_id}/hold`

2. **Inbound Call Handling** (NEW)
   - AMI event for incoming calls
   - Route to available agents (round-robin, skill-based)
   - Create inbound call records
   - API endpoint: `/api/calls/inbound/answer`

3. **Recording Management** (ENHANCE)
   - Store recording paths properly
   - AMI MonitorStart/MonitorStop events
   - Recording file cleanup job (optional)

4. **Call Quality Metrics** (NEW)
   - Store jitter, packet loss, MOS scores (if available)
   - Add to calls table or separate table

#### **Database Changes**

1. **Calls Table** (MODIFY)
   - Add `is_muted` BOOLEAN DEFAULT FALSE
   - Add `is_on_hold` BOOLEAN DEFAULT FALSE
   - Add `billsec` INTEGER (billed seconds from CDR)
   - Add `disposition` VARCHAR(50) (move from notes or add separately)

#### **Frontend Changes**

1. **Mute/Hold Controls** (NEW)
   - Add mute/unmute button
   - Add hold/unhold button
   - Visual indicators for mute/hold state

2. **Enhanced Call Display** (ENHANCE)
   - Show call quality metrics
   - Better call status indicators
   - Call duration timer (already exists, enhance)

---

### 🟢 PHASE 3: Advanced Features (Nice to Have - Future)

#### **Backend Changes**

1. **Predictive Dialer** (NEW)
   - Queue management
   - Auto-dialing logic
   - Answer machine detection

2. **IVR Integration** (NEW)
   - Dialplan integration
   - Menu handling
   - Call routing

3. **SMS Integration** (NEW)
   - Twilio/local provider integration
   - Send SMS after calls
   - Store SMS history

4. **WhatsApp Business API** (NEW)
   - Integration with WhatsApp API
   - Unified messaging

5. **Call Transcription** (NEW)
   - Integration with speech-to-text
   - Store transcripts

6. **Multi-tenant Support** (NEW)
   - Organization/company isolation
   - Separate trunks per tenant

---

## 📝 Step-by-Step Implementation Plan

### **STEP 1: AMI Event Listener (Critical)**
**Files to Create/Modify:**
- `backend/app/services/ami_event_listener.py` (NEW)
- `backend/app/services/asterisk_service.py` (MODIFY)
- `backend/app/services/channel_tracker.py` (NEW)
- `backend/app/main.py` (MODIFY - start event listener)

**What it does:**
- Connects to AMI and subscribes to events
- Listens for call events (Newchannel, Newstate, Hangup, etc.)
- Maps events to call records
- Broadcasts to WebSocket

### **STEP 2: Enhanced Call Origination**
**Files to Modify:**
- `backend/app/services/dialer_service.py`
- `backend/app/services/asterisk_service.py`

**What it does:**
- Originate call to agent first
- When agent answers, bridge to customer
- Track both channels

### **STEP 3: Channel Tracking**
**Files to Create:**
- `backend/app/services/channel_tracker.py`

**What it does:**
- Map call_unique_id to channels
- Track agent and customer channels
- Update call status based on channel events

### **STEP 4: WebSocket Event Routing**
**Files to Modify:**
- `backend/app/services/websocket_manager.py`
- `backend/app/services/ami_event_listener.py`

**What it does:**
- Route AMI events to WebSocket
- Send real-time updates to frontend
- Handle call status changes

### **STEP 5: Database Schema Updates**
**Files to Create:**
- `backend/migrations/add_channel_tracking.sql` (or use Alembic)

**What it does:**
- Add agent_channel, customer_channel, bridge_unique_id
- Add is_muted, is_on_hold if needed

### **STEP 6: Frontend Real-time Updates**
**Files to Modify:**
- `frontend/app/dialer/page.tsx`
- `frontend/lib/websocket.ts`

**What it does:**
- Handle AMI event messages
- Update UI based on call status
- Show real-time call state

### **STEP 7: Mute/Hold Features (Phase 2)**
**Files to Create/Modify:**
- `backend/app/api/routes/calls.py` (add mute/hold endpoints)
- `backend/app/services/asterisk_service.py` (add mute/hold methods)
- `frontend/components/agent/CallControls.tsx` (add buttons)

### **STEP 8: Inbound Call Handling (Phase 2)**
**Files to Create/Modify:**
- `backend/app/api/routes/calls.py` (add inbound endpoints)
- `backend/app/services/ami_event_listener.py` (handle incoming calls)
- `frontend/components/agent/IncomingCallModal.tsx` (NEW)

---

## 🎯 Priority Implementation Order

1. **AMI Event Listener** ⭐⭐⭐ (Critical - Enables real-time updates)
2. **Channel Tracking** ⭐⭐⭐ (Critical - Maps calls to Asterisk channels)
3. **Enhanced Call Origination** ⭐⭐⭐ (Critical - Proper call bridging)
4. **WebSocket Event Routing** ⭐⭐⭐ (Critical - Real-time UI updates)
5. **Database Schema Updates** ⭐⭐ (Important - Store channel info)
6. **Frontend Real-time Updates** ⭐⭐ (Important - Better UX)
7. **Mute/Hold** ⭐ (Nice to have)
8. **Inbound Calls** ⭐ (Nice to have)

---

## 📈 Estimated Completion After Implementation

**Current:** ~60-65% complete
**After Phase 1:** ~85-90% complete (production-ready for basic dialer)
**After Phase 2:** ~95% complete (full-featured dialer)
**After Phase 3:** 100% complete (enterprise dialer)

---

## 🚀 Next Steps

1. Review this plan
2. Confirm priorities
3. Start with Phase 1 implementation
4. Test with actual Asterisk instance
5. Iterate based on feedback

---

## ⚠️ Important Notes

- **Asterisk Configuration**: You'll need to configure Asterisk dialplan properly for agent-first calling
- **SIP Trunk**: Need working SIP trunk for outbound calls (Pakistan market)
- **Testing**: Test with actual SIP phones/softphones (Zoiper, X-Lite) before production
- **WebRTC**: Browser calling requires additional setup (res_sip_websocket module in Asterisk)
- **Security**: Change default AMI passwords, restrict AMI access by IP

---

Would you like me to start implementing Phase 1 changes now?