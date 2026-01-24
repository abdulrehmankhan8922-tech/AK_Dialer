# Quick Start: Local Testing with Softphone

## 🚀 5-Minute Setup

### Step 1: Start Asterisk
```bash
# Windows PowerShell
.\setup-local-testing.ps1

# Linux/Mac
chmod +x setup-local-testing.sh
./setup-local-testing.sh

# Or manually:
docker-compose -f docker-compose.asterisk.yml up -d
```

### Step 2: Configure Backend
Create `backend/.env` file:
```bash
USE_MOCK_DIALER=False  # ⚠️ CRITICAL: Must be False!
ASTERISK_HOST=localhost
ASTERISK_AMI_PORT=5038
ASTERISK_AMI_USERNAME=admin
ASTERISK_AMI_PASSWORD=amp111
```

### Step 3: Install Softphone
- Download **Zoiper**: https://www.zoiper.com/
- Install and open Zoiper

### Step 4: Configure Softphone
In Zoiper, add account:
- **Username:** `8013`
- **Password:** `password123`
- **Server:** `localhost`
- **Port:** `5060`
- **Transport:** `UDP`

Click "Add" and wait for "Registered" status.

### Step 5: Start Servers
```bash
# Terminal 1: Backend
cd backend
python -m uvicorn app.main:app --reload

# Terminal 2: Frontend
cd frontend
npm run dev
```

### Step 6: Test!
1. Open http://localhost:3000
2. Login to dialer
3. In "Manual Dial", enter: `9000`
4. Click "Dial"
5. **Softphone should ring!** (if you register extension 9000 as well)

---

## 📱 Softphone Settings Quick Reference

| Extension | Username | Password | Use Case |
|-----------|----------|----------|----------|
| 8013 | 8013 | password123 | Agent 1 |
| 8014 | 8014 | password123 | Agent 2 |
| 9000 | 9000 | test123 | Test/Customer |

---

## ✅ Verification Checklist

- [ ] Asterisk container is running: `docker ps`
- [ ] Backend `.env` has `USE_MOCK_DIALER=False`
- [ ] Softphone shows "Registered" status
- [ ] Backend server is running (port 8000)
- [ ] Frontend server is running (port 3000)
- [ ] Can login to dialer interface
- [ ] Can make a test call

---

## 🐛 Quick Troubleshooting

**Softphone won't register?**
```bash
# Check Asterisk logs
docker logs dialer-asterisk

# Check SIP peers
docker exec dialer-asterisk asterisk -rx "sip show peers"
```

**Calls don't work?**
- Verify `USE_MOCK_DIALER=False` in backend `.env`
- Restart backend server after changing `.env`
- Check agent extension in database matches softphone extension

**No audio?**
- Check RTP ports (10000-20000 UDP) are not blocked
- Try TCP instead of UDP in softphone

---

## 📚 Full Documentation

- **Detailed Guide:** `LOCAL_TESTING_GUIDE.md`
- **Softphone Reference:** `SOFTPHONE_QUICK_REFERENCE.md`
- **Testing Scenarios:** See `LOCAL_TESTING_GUIDE.md` Section 5

---

## 🎯 Next Steps

Once local testing works:
1. Deploy to your server
2. Configure real SIP trunk
3. Test with real phone numbers
4. Set up production monitoring

---

**Need help?** Check the detailed guides or Asterisk logs!
