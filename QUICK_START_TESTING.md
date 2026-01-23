# 🚀 Quick Start Testing Guide

This guide will help you quickly test your dialer project. For comprehensive test cases, see `TESTING_GUIDE.md`.

## ⚡ Quick Setup (5 minutes)

### 1. Start Database
```bash
# Make sure PostgreSQL is running
# Windows: Check Services or run:
pg_ctl start

# Verify connection
psql -U postgres -d dialer_db
```

### 2. Setup Database (if not done)
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE dialer_db;

# Exit psql and run setup script
\q
psql -U postgres -d dialer_db -f database_setup.sql
```

### 3. Start Backend Server
```bash
# Terminal 1
cd backend

# Activate virtual environment (Windows)
venv\Scripts\activate

# Install dependencies (if not done)
pip install -r requirements.txt

# Start server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Expected Output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

### 4. Start Frontend Server
```bash
# Terminal 2
cd frontend

# Install dependencies (if not done)
npm install

# Start development server
npm run dev
```

**Expected Output:**
```
✓ Ready in 2.5s
○ Local:        http://localhost:3000
```

---

## 🧪 Quick Test Scenarios

### Test 1: Basic Login (2 minutes)

1. **Open Browser:** `http://localhost:3000`
2. **Login as Admin:**
   - Username: `admin`
   - Password: `admin`
   - Should redirect to `/admin` dashboard

3. **Login as Agent:**
   - Logout first
   - Username: `agent1` (or any agent from database)
   - Password: `agent1`
   - Should redirect to `/dialer` page

**✅ Success Indicators:**
- No errors in browser console
- Dashboard/ Dialer page loads
- User info visible in topbar

---

### Test 2: Admin Dashboard (3 minutes)

1. **Login as Admin** (`admin` / `admin`)
2. **Check Dashboard:**
   - Summary cards visible (Total Agents, Total Calls, etc.)
   - Agents table visible below cards
   - Search box works (try typing agent username)

3. **Create New Agent:**
   - Click "Create Agent" button
   - Fill form:
     - Username: `testagent`
     - Full Name: `Test Agent`
     - Phone Extension: `1001`
     - Password: `test123`
   - Click "Create Agent"
   - Verify agent appears in table

4. **Edit Agent:**
   - Click "Edit" button on any agent
   - Change Full Name
   - Save and verify update

**✅ Success Indicators:**
- All cards show data
- Agents table populated
- Search filters correctly
- Create/Edit works without errors

---

### Test 3: Agent Dialer Interface (5 minutes)

1. **Login as Agent** (not admin)
2. **Check Dialer Page:**
   - Call Controls section visible
   - Statistics dashboard visible
   - Customer Information form visible
   - History tab works

3. **Test Manual Dial (Mock Mode):**
   - Enter phone number: `1234567890`
   - Click "Dial" button
   - Observe call status changes
   - Check call timer starts

4. **Test Call Controls:**
   - If call is active, test:
     - Mute/Unmute button
     - Hold/Resume button
     - Hangup button

**✅ Success Indicators:**
- All UI elements visible
- Call initiates (even in mock mode)
- Status updates in real-time
- Controls respond to clicks

---

### Test 4: Call History (2 minutes)

1. **Login as Agent**
2. **Click "History" tab**
3. **Check:**
   - Call history table visible
   - Filters work (All, Today, Outbound, Inbound)
   - Previous calls listed (if any)

**✅ Success Indicators:**
- History tab loads
- Filters work
- No errors in console

---

### Test 5: Reports & Analytics (2 minutes)

1. **Login as Admin**
2. **Navigate to Reports** (from sidebar)
3. **Check:**
   - Stats cards visible
   - "All Agents Performance" table visible
   - Search box works (try searching agents)
   - Date range selector works

**✅ Success Indicators:**
- Reports page loads
- Statistics display correctly
- Search filters agents
- No errors

---

### Test 6: Contacts Management (3 minutes)

1. **Login as Agent or Admin**
2. **Navigate to Contacts** (from sidebar)
3. **Create Contact:**
   - Click "Create Contact" button
   - Fill form:
     - Name: `Test Customer`
     - Phone: `9876543210`
     - Email: `test@example.com`
     - Campaign: Select a campaign
   - Click "Create"
   - Verify contact appears in list

**✅ Success Indicators:**
- Contacts page loads
- Create contact works
- Contact appears in table
- No errors

---

## 🔍 Verify Backend API

### Test API Endpoints

1. **Open API Docs:** `http://localhost:8000/docs`
2. **Test Login Endpoint:**
   - Click `POST /api/auth/login`
   - Click "Try it out"
   - Enter:
     ```json
     {
       "username": "admin",
       "password": "admin"
     }
     ```
   - Click "Execute"
   - Should return token

3. **Test Other Endpoints:**
   - `GET /api/agents/me` (with token)
   - `GET /api/stats/today` (with token)
   - `GET /api/campaigns` (with token)

**✅ Success Indicators:**
- API docs load
- Endpoints respond
- Authentication works
- No 500 errors

---

## 🐛 Common Issues & Quick Fixes

### Issue 1: Backend won't start
**Error:** `ModuleNotFoundError` or `ImportError`

**Fix:**
```bash
cd backend
pip install -r requirements.txt
```

---

### Issue 2: Database connection error
**Error:** `could not connect to server`

**Fix:**
1. Check PostgreSQL is running
2. Verify database exists: `psql -U postgres -l`
3. Check connection string in `backend/app/core/config.py`

---

### Issue 3: Frontend won't start
**Error:** `Port 3000 already in use`

**Fix:**
```bash
# Kill process on port 3000 (Windows)
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Or use different port
npm run dev -- -p 3001
```

---

### Issue 4: CORS errors
**Error:** `CORS policy` in browser console

**Fix:**
- Check `backend/app/main.py` has CORS middleware
- Verify frontend URL is in allowed origins

---

### Issue 5: WebSocket not connecting
**Error:** WebSocket connection failed

**Fix:**
1. Check backend is running
2. Check WebSocket endpoint: `ws://localhost:8000/ws`
3. Verify token is valid
4. Check browser console for errors

---

## 📊 Testing Checklist

Use this checklist to track your testing progress:

### Basic Functionality
- [ ] Admin can login
- [ ] Agent can login
- [ ] Logout works
- [ ] Admin dashboard loads
- [ ] Agent dialer loads
- [ ] No console errors

### Admin Features
- [ ] View all agents
- [ ] Create new agent
- [ ] Edit agent
- [ ] Search agents
- [ ] View statistics
- [ ] View reports

### Agent Features
- [ ] View call controls
- [ ] View statistics
- [ ] Manual dial (mock mode)
- [ ] View call history
- [ ] Customer info form
- [ ] Disposition codes

### Data & API
- [ ] API docs accessible
- [ ] Login endpoint works
- [ ] Stats endpoint works
- [ ] WebSocket connects
- [ ] Database queries work

---

## 🎯 Next Steps

1. **Complete Basic Tests:** Run all quick test scenarios above
2. **Read Full Guide:** Check `TESTING_GUIDE.md` for 28 detailed test cases
3. **Test with Asterisk:** If you have Asterisk configured, test real calls
4. **Load Testing:** Test with multiple agents and concurrent calls
5. **Edge Cases:** Test error scenarios, invalid inputs, etc.

---

## 📞 Need Help?

- **Backend Issues:** Check `backend/app/main.py` logs
- **Frontend Issues:** Check browser console (F12)
- **Database Issues:** Check PostgreSQL logs
- **Asterisk Issues:** Check `ASTERISK_SETUP.md`

---

## ✅ Success Criteria

Your project is working correctly if:
- ✅ Both servers start without errors
- ✅ You can login as admin and agent
- ✅ All pages load without errors
- ✅ API endpoints respond correctly
- ✅ WebSocket connects
- ✅ No critical errors in console/logs

---

**Last Updated:** 2024
**Version:** 1.0
