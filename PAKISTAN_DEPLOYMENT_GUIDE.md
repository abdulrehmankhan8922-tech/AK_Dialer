# Pakistan Call Center Dialer Deployment Guide

## 🎯 Overview
This guide helps you deploy your custom dialer for a Pakistani call center client with PTA compliance and local considerations.

---

## 📋 Pre-Deployment Checklist

### Legal & Compliance
- [ ] Register call center business with PTA (Pakistan Telecommunication Authority)
- [ ] Obtain AED (Auto Electronic Dialing) license if required
- [ ] Implement DNC (Do Not Call) list functionality
- [ ] Add call recording consent messages (Urdu/English)
- [ ] Prepare Terms of Service for agents/customers

### Technical Requirements
- [ ] Pakistani SIP Trunk account
- [ ] VPS/Server (UAE/Singapore recommended for latency)
- [ ] Domain name (.pk or .com)
- [ ] SSL certificate
- [ ] Backup solution

---

## 🚀 Step-by-Step Deployment

### Step 1: Choose SIP Trunk Provider (Pakistan)

**Recommended Providers:**
1. **PTCL Business SIP** (Government-owned, most reliable)
   - Contact: PTCL Business Sales
   - Cost: PKR 5,000-15,000/month
   - Requires: Business registration certificate

2. **Voxlocus** (Popular local VoIP provider)
   - Website: voxlocus.com
   - Cost: $30-100/month USD
   - Easier setup, good support

3. **Telenor Business VoIP**
   - Good for mobile-focused campaigns
   - Cost: PKR 8,000-20,000/month

**What You Need from Provider:**
- SIP server address (e.g., sip.voxlocus.com)
- SIP username/password
- DID numbers (if needed)
- Caller ID approval
- Concurrent call limits

### Step 2: Server Setup

**Recommended Locations:**
- **Bahrain** (Lowest latency to Pakistan ~80ms)
- **Singapore** (Good infrastructure, ~120ms)
- **UAE** (Middle ground, ~100ms)

**VPS Requirements:**
```
CPU: 4+ cores
RAM: 8GB minimum (16GB recommended)
Storage: 100GB SSD
OS: Ubuntu 22.04 LTS
Bandwidth: Unlimited (or 10TB/month)
```

**Providers:**
- DigitalOcean (Bahrain datacenter) - $48/month
- AWS Lightsail (Bahrain) - $40/month
- Vultr (Singapore) - $48/month
- Hetzner (Germany, but very cheap) - $30/month

### Step 3: Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Python 3.11+
sudo apt install python3.11 python3.11-venv python3-pip -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Install Asterisk (for SIP)
sudo apt install asterisk -y

# Install Nginx (reverse proxy)
sudo apt install nginx -y

# Install SSL certificate tool
sudo apt install certbot python3-certbot-nginx -y
```

### Step 4: Deploy Your Dialer Application

```bash
# Clone or upload your project
cd /var/www
sudo mkdir dialer
sudo chown $USER:$USER dialer
cd dialer

# Upload your project files (use SCP, Git, or FTP)

# Backend Setup
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend Setup
cd ../frontend
npm install
npm run build

# Database Setup
sudo -u postgres psql
CREATE DATABASE dialer_db;
CREATE USER dialer_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE dialer_db TO dialer_user;
\q

# Update backend/.env
DATABASE_URL=postgresql://dialer_user:your_secure_password@localhost:5432/dialer_db
ASTERISK_HOST=localhost
ASTERISK_AMI_PORT=5038
ASTERISK_AMI_USERNAME=admin
ASTERISK_AMI_PASSWORD=your_asterisk_password
USE_MOCK_DIALER=False
SECRET_KEY=your_super_secret_key_change_this
```

### Step 5: Configure Asterisk for SIP Trunk

Edit `/etc/asterisk/sip.conf`:

```ini
[general]
context=default
allowguest=no
bindport=5060
bindaddr=0.0.0.0
srvlookup=yes

; SIP Trunk from Provider (Example: Voxlocus)
[voxlocus-trunk]
type=peer
host=sip.voxlocus.com
username=your_sip_username
secret=your_sip_password
fromuser=your_sip_username
fromdomain=sip.voxlocus.com
canreinvite=no
insecure=invite,port
qualify=yes
nat=force_rport,comedia
dtmfmode=rfc2833
context=from-trunk

; Agent Extensions
[8013]
type=friend
host=dynamic
secret=agent_password
context=from-internal
allow=ulaw,alaw,gsm

[8014]
type=friend
host=dynamic
secret=agent_password
context=from-internal
allow=ulaw,alaw,gsm
```

Edit `/etc/asterisk/extensions.conf`:

```ini
[from-internal]
; Agent makes outbound call
exten => _X.,1,NoOp(Calling ${EXTEN} via trunk)
exten => _X.,n,Dial(SIP/voxlocus-trunk/${EXTEN},60)
exten => _X.,n,Hangup()

[from-trunk]
; Inbound calls
exten => _X.,1,NoOp(Incoming call to ${EXTEN})
exten => _X.,n,Dial(SIP/8013,20)
exten => _X.,n,Hangup()
```

Restart Asterisk:
```bash
sudo systemctl restart asterisk
sudo systemctl enable asterisk
```

### Step 6: Configure Nginx Reverse Proxy

Create `/etc/nginx/sites-available/dialer`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # Frontend
    location / {
        root /var/www/dialer/frontend/.next;
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API
    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # WebSocket support
    location /ws {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Enable site and get SSL:
```bash
sudo ln -s /etc/nginx/sites-available/dialer /etc/nginx/sites-enabled/
sudo nginx -t
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
sudo systemctl restart nginx
```

### Step 7: Setup Systemd Services

Create `/etc/systemd/system/dialer-backend.service`:

```ini
[Unit]
Description=Dialer Backend API
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/dialer/backend
Environment="PATH=/var/www/dialer/backend/venv/bin"
ExecStart=/var/www/dialer/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable dialer-backend
sudo systemctl start dialer-backend
```

### Step 8: Pakistan-Specific Customizations

#### A. Add Urdu/English Language Support

Create `backend/app/locale/urdu.py`:
```python
URDU_PROMPTS = {
    "call_recording_notice": "یہ کال ریکارڈ کی جا رہی ہے",
    "please_wait": "براہ کرم انتظار کریں",
    "agent_busy": "ایجنٹ مصروف ہے"
}
```

#### B. Add CNIC Verification (Common in PK)

Update contact model:
```python
# In backend/app/models/contact.py
cnic = Column(String, nullable=True)  # Add CNIC field
```

#### C. Implement DNC (Do Not Call) List

Create `backend/app/models/dnc.py`:
```python
class DNCList(Base):
    __tablename__ = "dnc_list"
    
    id = Column(Integer, primary_key=True)
    phone_number = Column(String, unique=True, index=True)
    reason = Column(String, nullable=True)
    added_at = Column(DateTime, default=datetime.utcnow)
```

#### D. Add Call Recording Consent

Update dialer service to play consent message:
```python
# In backend/app/services/dialer_service.py
async def play_consent_message(self, channel_name: str):
    # Play: "This call is being recorded. Press 1 to continue, 2 to decline"
    # In Urdu: "یہ کال ریکارڈ کی جا رہی ہے..."
    pass
```

#### E. Pakistan Number Format Validation

Create `backend/app/utils/phone_validator.py`:
```python
import re

def validate_pakistan_number(phone: str) -> bool:
    """Validate Pakistani phone numbers"""
    # Remove spaces, dashes
    phone = re.sub(r'[\s-]', '', phone)
    
    # Formats: 03001234567, +923001234567, 923001234567
    patterns = [
        r'^0[0-9]{10}$',           # 03001234567
        r'^\+92[0-9]{10}$',        # +923001234567
        r'^92[0-9]{10}$'           # 923001234567
    ]
    
    return any(re.match(pattern, phone) for pattern in patterns)

def format_pakistan_number(phone: str) -> str:
    """Format to standard: +923001234567"""
    phone = re.sub(r'[\s-]', '', phone)
    if phone.startswith('0'):
        return '+92' + phone[1:]
    elif phone.startswith('92'):
        return '+' + phone
    elif phone.startswith('+92'):
        return phone
    return phone
```

---

## 💰 Cost Breakdown (Monthly)

### Minimum Setup:
- VPS Server (Bahrain): $48/month
- SIP Trunk (Voxlocus): $50/month
- Domain + SSL: $2/month
- SMS Gateway (optional): $30/month
- **Total: ~$130/month (~PKR 36,000)**

### Recommended Setup:
- VPS Server (better specs): $80/month
- SIP Trunk (PTCL Business): $100/month
- Domain + SSL: $2/month
- SMS Gateway: $50/month
- Backup Storage: $10/month
- **Total: ~$242/month (~PKR 67,000)**

---

## 🔒 Security Checklist

- [ ] Change all default passwords
- [ ] Enable firewall (UFW)
- [ ] Setup fail2ban for brute force protection
- [ ] Regular backups (daily)
- [ ] SSL/TLS encryption
- [ ] Database encryption at rest
- [ ] Regular security updates
- [ ] Access logging

```bash
# Setup firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 5060/udp  # SIP
sudo ufw allow 10000:20000/udp  # RTP
sudo ufw enable

# Setup fail2ban
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
```

---

## 📊 Monitoring & Maintenance

### Daily:
- Check call logs
- Monitor server resources
- Review error logs

### Weekly:
- Review agent performance
- Check SIP trunk usage
- Backup database

### Monthly:
- Security updates
- Performance optimization
- Cost review

---

## 🆘 Troubleshooting

### Common Issues:

1. **Calls not connecting:**
   - Check SIP trunk credentials
   - Verify firewall rules
   - Test with `asterisk -rvvv` (debug mode)

2. **High latency:**
   - Choose closer datacenter
   - Optimize network routes
   - Use local DNS (1.1.1.1)

3. **PTA compliance issues:**
   - Keep call logs for 3 months (required)
   - Implement DNC list checking
   - Add recording consent

---

## 📞 Support Contacts (Pakistan)

- **PTA Helpdesk**: 0800-55055
- **PTCL Business**: 0800-80800
- **Voxlocus Support**: support@voxlocus.com

---

## ✅ Go-Live Checklist

- [ ] SIP trunk tested and working
- [ ] Asterisk configured correctly
- [ ] Database populated with test data
- [ ] Agents trained on system
- [ ] Monitoring setup
- [ ] Backups configured
- [ ] SSL certificate installed
- [ ] Domain DNS configured
- [ ] PTA compliance implemented
- [ ] Test calls completed successfully

---

## 🎯 Next Steps

1. **Week 1**: Setup server, install dependencies
2. **Week 2**: Configure SIP trunk, test calls
3. **Week 3**: Deploy application, customize for client
4. **Week 4**: Training, testing, go-live preparation

---

**Good luck with your deployment! 🚀**
