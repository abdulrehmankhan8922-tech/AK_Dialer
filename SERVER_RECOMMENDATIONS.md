# 🖥️ Server Recommendations for Dialer Setup

Complete guide to choosing the right server for your dialer system.

---

## 📊 System Requirements

### Minimum Requirements (Small Setup - 5-10 Agents)

```
CPU: 4 cores
RAM: 8GB
Storage: 100GB SSD
Bandwidth: 100Mbps (unlimited preferred)
OS: Ubuntu 22.04 LTS
```

### Recommended Requirements (Medium Setup - 20-50 Agents)

```
CPU: 8 cores
RAM: 16GB
Storage: 200GB SSD
Bandwidth: 1Gbps (unlimited preferred)
OS: Ubuntu 22.04 LTS
```

### Production Requirements (Large Setup - 50+ Agents)

```
CPU: 16+ cores
RAM: 32GB+
Storage: 500GB+ SSD
Bandwidth: 10Gbps (unlimited preferred)
OS: Ubuntu 22.04 LTS
Load Balancer: Recommended
```

---

## 🌍 Server Location Recommendations

### For Pakistani Market

**Priority Order:**

1. **Bahrain** ⭐ (Best Choice)
   - **Latency to Pakistan:** ~80-100ms
   - **Cost:** Medium
   - **Providers:** DigitalOcean, AWS, Vultr
   - **Why:** Lowest latency, good infrastructure

2. **UAE (Dubai)** ⭐
   - **Latency to Pakistan:** ~90-110ms
   - **Cost:** Medium-High
   - **Providers:** AWS, Azure, DigitalOcean
   - **Why:** Excellent infrastructure, many providers

3. **Singapore**
   - **Latency to Pakistan:** ~120-150ms
   - **Cost:** Medium
   - **Providers:** DigitalOcean, Vultr, AWS
   - **Why:** Good infrastructure, reliable

4. **India (Mumbai)**
   - **Latency to Pakistan:** ~50-80ms (but routing may vary)
   - **Cost:** Low-Medium
   - **Providers:** AWS, DigitalOcean
   - **Why:** Very close, but check routing

---

## 💰 Recommended Providers & Plans

### Option 1: DigitalOcean (Recommended for Start)

**Location:** Bahrain or Singapore

**Droplet Plans:**

#### Starter Plan (5-10 Agents)
```
Plan: Regular Droplet
CPU: 4 vCPU
RAM: 8GB
Storage: 160GB SSD
Bandwidth: 5TB transfer
Price: $48/month (~PKR 13,500/month)
Location: Bahrain
```

#### Medium Plan (20-50 Agents)
```
Plan: Regular Droplet
CPU: 8 vCPU
RAM: 16GB
Storage: 320GB SSD
Bandwidth: 6TB transfer
Price: $96/month (~PKR 27,000/month)
Location: Bahrain
```

#### Production Plan (50+ Agents)
```
Plan: Regular Droplet
CPU: 16 vCPU
RAM: 32GB
Storage: 640GB SSD
Bandwidth: 7TB transfer
Price: $192/month (~PKR 54,000/month)
Location: Bahrain
```

**Pros:**
- ✅ Simple pricing
- ✅ Good documentation
- ✅ Easy to scale
- ✅ Bahrain datacenter available

**Cons:**
- ❌ Bandwidth limits (but generous)
- ❌ No free tier

**Link:** https://www.digitalocean.com/

---

### Option 2: AWS Lightsail (Budget-Friendly)

**Location:** Bahrain or Mumbai

**Plans:**

#### Starter Plan
```
Plan: Lightsail
CPU: 2 vCPU
RAM: 4GB
Storage: 80GB SSD
Bandwidth: 3TB transfer
Price: $40/month (~PKR 11,200/month)
Location: Bahrain
```

#### Medium Plan
```
Plan: Lightsail
CPU: 4 vCPU
RAM: 8GB
Storage: 160GB SSD
Bandwidth: 5TB transfer
Price: $80/month (~PKR 22,400/month)
Location: Bahrain
```

**Pros:**
- ✅ Very affordable
- ✅ Predictable pricing
- ✅ Easy setup
- ✅ Good for small-medium setups

**Cons:**
- ❌ Limited customization
- ❌ Less powerful than regular EC2

**Link:** https://aws.amazon.com/lightsail/

---

### Option 3: Vultr (Best Performance/Price)

**Location:** Singapore or Bahrain

**Plans:**

#### Starter Plan
```
Plan: Regular Performance
CPU: 4 vCPU
RAM: 8GB
Storage: 160GB SSD
Bandwidth: 4TB transfer
Price: $48/month (~PKR 13,500/month)
Location: Singapore
```

#### Medium Plan
```
Plan: Regular Performance
CPU: 8 vCPU
RAM: 16GB
Storage: 320GB SSD
Bandwidth: 5TB transfer
Price: $96/month (~PKR 27,000/month)
Location: Singapore
```

**Pros:**
- ✅ Excellent performance
- ✅ Good pricing
- ✅ Hourly billing available
- ✅ Multiple locations

**Cons:**
- ❌ Less known than AWS/DO
- ❌ Smaller community

**Link:** https://www.vultr.com/

---

### Option 4: Hetzner (Cheapest - Europe)

**Location:** Germany (but very cheap)

**Plans:**

#### Starter Plan
```
Plan: CPX31
CPU: 4 vCPU
RAM: 8GB
Storage: 160GB SSD
Bandwidth: 20TB transfer
Price: €12.29/month (~PKR 3,700/month)
Location: Germany
```

**Pros:**
- ✅ Very cheap
- ✅ Excellent performance
- ✅ Generous bandwidth
- ✅ Great for testing

**Cons:**
- ❌ Higher latency to Pakistan (~200ms)
- ❌ Europe location only

**Link:** https://www.hetzner.com/

---

### Option 5: Contabo (Budget Option)

**Location:** Singapore

**Plans:**

#### Starter Plan
```
Plan: VPS
CPU: 4 vCPU
RAM: 8GB
Storage: 200GB SSD
Bandwidth: Unlimited
Price: $9.99/month (~PKR 2,800/month)
Location: Singapore
```

**Pros:**
- ✅ Very cheap
- ✅ Unlimited bandwidth
- ✅ Good storage

**Cons:**
- ❌ Performance can vary
- ❌ Less reliable than premium providers
- ❌ Support may be slower

**Link:** https://contabo.com/

---

## 🎯 My Recommendation

### For Starting Out (Testing/Small Setup)

**Best Choice: DigitalOcean Bahrain - 4 vCPU / 8GB RAM**
- **Price:** $48/month (~PKR 13,500)
- **Why:** Good balance of price, performance, and location
- **Good for:** 5-15 agents

### For Production (Medium Setup)

**Best Choice: Vultr Singapore - 8 vCPU / 16GB RAM**
- **Price:** $96/month (~PKR 27,000)
- **Why:** Excellent performance, good location
- **Good for:** 20-50 agents

### For Budget-Conscious (Testing Only)

**Best Choice: Hetzner Germany - 4 vCPU / 8GB RAM**
- **Price:** €12.29/month (~PKR 3,700)
- **Why:** Very cheap, good for testing
- **Note:** Higher latency, not ideal for production

---

## 📦 What You'll Install on Server

### Required Software Stack

```
1. Operating System: Ubuntu 22.04 LTS
2. PostgreSQL: Database (2GB RAM recommended)
3. Asterisk: Telephony (2-4GB RAM recommended)
4. Python 3.11+: Backend (FastAPI)
5. Node.js 18+: Frontend (Next.js)
6. Nginx: Reverse Proxy & SSL
7. PM2/Supervisor: Process Management
8. Certbot: SSL Certificates
```

### Resource Allocation (8GB RAM Example)

```
PostgreSQL:     1.5GB
Asterisk:       2GB
Backend (FastAPI): 1GB
Frontend (Next.js): 500MB
Nginx:          100MB
System:         1GB
Buffer:         1.9GB
```

---

## 💡 Cost Breakdown (Monthly)

### Small Setup (5-10 Agents)

```
Server (DigitalOcean):     $48  (~PKR 13,500)
SIP Trunk (Voxlocus):      $30  (~PKR 8,400)
Domain Name:               $1   (~PKR 280)
SSL Certificate:           $0   (Free - Let's Encrypt)
Backup Storage:            $5   (~PKR 1,400)
─────────────────────────────────────────────
Total:                     $84  (~PKR 23,500/month)
```

### Medium Setup (20-50 Agents)

```
Server (Vultr):            $96  (~PKR 27,000)
SIP Trunk (Voxlocus):      $80  (~PKR 22,400)
Domain Name:                $1   (~PKR 280)
SSL Certificate:            $0   (Free)
Backup Storage:            $10   (~PKR 2,800)
Monitoring:                 $5   (~PKR 1,400)
─────────────────────────────────────────────
Total:                    $192  (~PKR 54,000/month)
```

---

## 🚀 Setup Steps After Buying Server

### 1. Initial Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Create user
sudo adduser dialer
sudo usermod -aG sudo dialer

# Setup firewall
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 5038/tcp  # Asterisk AMI
sudo ufw allow 5060/udp  # SIP
sudo ufw allow 10000:10099/udp  # RTP
sudo ufw enable
```

### 2. Install Required Software

```bash
# PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Python
sudo apt install python3.11 python3.11-venv python3-pip -y

# Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Asterisk
sudo apt install asterisk -y

# Nginx
sudo apt install nginx -y

# Certbot (SSL)
sudo apt install certbot python3-certbot-nginx -y
```

### 3. Deploy Your Application

Follow the deployment guide in `PAKISTAN_DEPLOYMENT_GUIDE.md`

---

## ⚠️ Important Considerations

### 1. Bandwidth Requirements

**Per Call:**
- SIP Signaling: ~50 Kbps
- RTP Audio: ~80 Kbps per direction
- **Total per call:** ~160 Kbps

**For 10 concurrent calls:** ~1.6 Mbps
**For 50 concurrent calls:** ~8 Mbps

**Recommendation:** Get at least 100 Mbps, preferably unlimited

### 2. Storage Requirements

**Initial Setup:**
- OS: 20GB
- Applications: 10GB
- Database: 5GB
- **Total:** ~35GB

**Ongoing:**
- Call recordings: ~1MB per minute
- Database growth: ~100MB per 10,000 calls
- Logs: ~500MB per month

**Recommendation:** Start with 100GB, scale to 200GB+

### 3. Backup Strategy

**Essential:**
- Daily database backups
- Weekly full server backups
- Store backups off-server (S3, Backblaze)

**Cost:** $5-10/month for backup storage

### 4. Monitoring

**Recommended Tools:**
- Uptime monitoring (UptimeRobot - Free)
- Server monitoring (Netdata - Free)
- Application monitoring (Sentry - Free tier)

---

## 🎯 Final Recommendation

### For Your Pakistani Dialer Project:

**Start With:**
- **Provider:** DigitalOcean
- **Location:** Bahrain
- **Plan:** 4 vCPU / 8GB RAM / 160GB SSD
- **Cost:** $48/month (~PKR 13,500/month)

**Why:**
1. ✅ Low latency to Pakistan (~80ms)
2. ✅ Good performance for 10-20 agents
3. ✅ Easy to scale up later
4. ✅ Reliable and well-documented
5. ✅ Reasonable price

**Upgrade Path:**
- When you reach 20+ agents → Upgrade to 8 vCPU / 16GB
- When you reach 50+ agents → Consider load balancer + multiple servers

---

## 📞 Next Steps

1. **Choose Provider:** DigitalOcean Bahrain (recommended)
2. **Buy Server:** 4 vCPU / 8GB RAM plan
3. **Setup Domain:** Buy .pk or .com domain
4. **Configure Server:** Follow deployment guide
5. **Setup SIP Trunk:** Get Pakistani SIP trunk account
6. **Deploy Application:** Follow `PAKISTAN_DEPLOYMENT_GUIDE.md`

---

## 💰 Budget Summary

**Minimum Monthly Cost (Small Setup):**
- Server: $48 (PKR 13,500)
- SIP Trunk: $30 (PKR 8,400)
- Domain: $1 (PKR 280)
- **Total: ~$79/month (~PKR 22,000/month)**

**Recommended Monthly Cost (Medium Setup):**
- Server: $96 (PKR 27,000)
- SIP Trunk: $80 (PKR 22,400)
- Domain + Extras: $10 (PKR 2,800)
- **Total: ~$186/month (~PKR 52,000/month)**

---

**Last Updated:** 2024
**Version:** 1.0
