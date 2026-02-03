# Quick Setup Guide - Naya Tel + Excel Import

## ✅ What's Done

1. ✅ Excel Import Feature - Added to backend and frontend
2. ✅ Naya Tel SIP Trunk Configuration Guide
3. ✅ Outbound Caller ID: 0516125672
4. ✅ Inbound Call Routing

## 📋 Step-by-Step Setup

### Step 1: Install Python Dependencies

On your server:

```bash
cd /root/AK_Dialer/backend
source venv/bin/activate
pip install openpyxl==3.1.2 pandas==2.1.4
```

### Step 2: Configure Naya Tel SIP Trunk

```bash
sudo nano /etc/asterisk/pjsip.conf
```

Add at the end:

```ini
; Naya Tel SIP Trunk
[trunk]
type=endpoint
context=from-trunk
disallow=all
allow=ulaw
allow=alaw
aors=trunk
auth=trunk
outbound_auth=trunk
rtp_symmetric=yes
force_rport=yes
rewrite_contact=yes

[trunk]
type=auth
auth_type=userpass
password=YOUR_NAYA_TEL_PASSWORD
username=YOUR_NAYA_TEL_USERNAME

[trunk]
type=aor
contact=sip:YOUR_NAYA_TEL_SERVER:5060
qualify_frequency=60
```

**Ask Naya Tel for:**
- SIP Server Address
- Username
- Password

### Step 3: Update Dialplan

```bash
sudo nano /etc/asterisk/extensions.conf
```

Update:

```ini
[globals]
TRUNK=PJSIP/trunk

[from-internal]
; Outbound calls with caller ID 0516125672
exten => _X.,1,NoOp(Outbound call to ${EXTEN})
exten => _X.,n,Set(CALLERID(num)=0516125672)
exten => _X.,n,Set(CALLERID(name)=Your Company)
exten => _X.,n,Dial(${TRUNK}/${EXTEN},60)
exten => _X.,n,Hangup()

[from-trunk]
; Incoming calls - route to agents
exten => _X.,1,NoOp(Incoming call from ${CALLERID(num)})
exten => _X.,n,Dial(PJSIP/8013,20)
exten => _X.,n,Dial(PJSIP/8014,20)
exten => _X.,n,Hangup()
```

### Step 4: Reload Asterisk

```bash
sudo asterisk -rx "module reload res_pjsip.so"
sudo asterisk -rx "dialplan reload"
sudo asterisk -rx "pjsip show endpoint trunk"
```

### Step 5: Restart Backend

```bash
sudo systemctl restart dialer-backend.service
```

### Step 6: Test Excel Import

1. Login to dialer: `http://163.245.208.168:3000`
2. Go to Contacts page
3. Click "📥 Import Excel"
4. Select your Excel file
5. Make sure a campaign is selected
6. Wait for import to complete

## 📊 Excel File Format

Your Excel file should have these columns (phone is required):

| name | phone | address | city | occupation | gender | whatsapp | email | comments |
|------|-------|---------|------|------------|--------|----------|-------|----------|
| Ahmed Ali | 03001234567 | 123 Main St | Karachi | Engineer | M | 03001234567 | ahmed@example.com | Notes |
| Fatima Khan | 03001234568 | 456 Park Ave | Lahore | Teacher | F | 03001234568 | fatima@example.com | Notes |

**Notes:**
- `phone` column is **required**
- All other columns are optional
- Gender: M, F, or U (Male, Female, Undefined)
- Phone numbers can be in any format (03001234567, +923001234567, etc.)

## 🧪 Testing

### Test Outbound Call:
1. Login as agent
2. Go to Dialer page
3. Enter a phone number
4. Click Dial
5. Call should show caller ID: 0516125672

### Test Inbound Call:
1. Call your inbound number (ask Naya Tel)
2. Should ring agent 8013, then 8014

### Test Excel Import:
1. Create Excel file with contacts
2. Import via Contacts page
3. Check imported contacts

## 📞 Naya Tel Information Needed

Ask Naya Tel for:
1. ✅ SIP Server Address (e.g., sip.nayatel.com or IP)
2. ✅ Username
3. ✅ Password
4. ✅ Port (usually 5060)
5. ✅ Inbound Number (DID) - if receiving calls

## 🎯 Summary

- **Outbound Caller ID**: 0516125672 ✅
- **Inbound Routing**: Rings agents 8013, then 8014 ✅
- **Excel Import**: Available in Contacts page ✅
- **Naya Tel Trunk**: Configure in `/etc/asterisk/pjsip.conf` ✅

Once you get Naya Tel credentials, update the config and you're ready to go!
