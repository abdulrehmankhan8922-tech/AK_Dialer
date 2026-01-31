# Firewall IP Management Guide

## Quick Setup

### Step 1: Make Script Executable

```bash
chmod +x /root/AK_Dialer/manage-firewall-ips.sh
```

### Step 2: Initial Setup (Allow Your IP)

```bash
# Find your current IP
curl ifconfig.me

# Add your IP (replace with your actual IP)
/root/AK_Dialer/manage-firewall-ips.sh add 139.135.39.43
```

### Step 3: Ensure Localhost is Allowed

```bash
# Allow server to connect to itself (for backend to Asterisk)
sudo ufw allow from 127.0.0.1 to any port 5038 proto tcp
sudo ufw allow from 127.0.0.1 to any port 5060 proto udp
sudo ufw allow from 127.0.0.1 to any port 8000 proto tcp
```

---

## Usage

### Add an IP Address

```bash
/root/AK_Dialer/manage-firewall-ips.sh add 192.168.1.100
```

This will allow the IP to access:
- SSH (port 22)
- Backend API (port 8000)
- Frontend (port 3000)
- SIP (port 5060 UDP/TCP)
- AMI (port 5038)
- RTP (ports 10000-20000 UDP)

### Remove an IP Address

```bash
/root/AK_Dialer/manage-firewall-ips.sh remove 192.168.1.100
```

### List All Allowed IPs

```bash
/root/AK_Dialer/manage-firewall-ips.sh list
```

### Reset All IP Rules

```bash
/root/AK_Dialer/manage-firewall-ips.sh reset
```

---

## Examples

### Allow Your Office IP

```bash
/root/AK_Dialer/manage-firewall-ips.sh add 203.0.113.50
```

### Allow Your Home IP

```bash
/root/AK_Dialer/manage-firewall-ips.sh add 198.51.100.25
```

### Allow Multiple IPs

```bash
/root/AK_Dialer/manage-firewall-ips.sh add 203.0.113.50
/root/AK_Dialer/manage-firewall-ips.sh add 198.51.100.25
/root/AK_Dialer/manage-firewall-ips.sh add 192.0.2.100
```

### Remove an IP (Employee Left)

```bash
/root/AK_Dialer/manage-firewall-ips.sh remove 192.0.2.100
```

---

## Verify Firewall Rules

```bash
# Check all rules
sudo ufw status numbered

# Check rules for specific IP
sudo ufw status | grep "139.135.39.43"
```

---

## Important Notes

1. **Always allow localhost** - Server needs to connect to itself
2. **Keep SSH access** - Make sure you don't lock yourself out
3. **IPs are saved** - Allowed IPs are saved in `/root/firewall-allowed-ips.txt`
4. **Easy to restore** - If you need to re-add IPs, they're in the file

---

## Quick Reference

```bash
# Add IP
./manage-firewall-ips.sh add YOUR_IP

# Remove IP
./manage-firewall-ips.sh remove YOUR_IP

# List IPs
./manage-firewall-ips.sh list

# Reset all
./manage-firewall-ips.sh reset
```

---

## Troubleshooting

### Locked Out?

If you're locked out of SSH:
1. Use your VPS provider's web console
2. Or use their firewall management panel
3. Or contact support

### Backend Can't Connect to Asterisk?

Ensure localhost is allowed:
```bash
sudo ufw allow from 127.0.0.1
```

### Need to Allow a Subnet?

For a subnet (e.g., office network):
```bash
sudo ufw allow from 192.168.1.0/24 to any port 22 proto tcp
```

---

**That's it! Easy IP management for your server.** 🔒
