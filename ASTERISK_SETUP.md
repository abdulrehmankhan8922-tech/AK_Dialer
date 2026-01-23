# Asterisk Integration Setup Guide

## Overview

The dialer has been fully integrated with **Asterisk AMI (Asterisk Manager Interface)** for call control. This replaces FreeSWITCH and provides full telephony functionality.

## Asterisk Configuration

### 1. Install Asterisk

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install asterisk

# CentOS/RHEL
sudo yum install asterisk

# macOS (Homebrew)
brew install asterisk
```

### 2. Configure Asterisk Manager Interface (AMI)

Edit `/etc/asterisk/manager.conf`:

```ini
[general]
enabled = yes
port = 5038
bindaddr = 0.0.0.0

[admin]
secret = amp111
deny = 0.0.0.0/0.0.0.0
permit = 127.0.0.1/255.255.255.255
read = system,call,log,verbose,command,agent,user,config,dtmf,reporting,cdr,dialplan
write = system,call,log,verbose,command,agent,user,config,dtmf,reporting,cdr,dialplan
```

**Important:** Change the password in production!

### 3. Configure Dialplan

Edit `/etc/asterisk/extensions.conf`:

```ini
[globals]
; SIP Trunk configuration
TRUNK=SIP/your_trunk_name

[from-internal]
; Agent extensions
exten => 8013,1,Dial(SIP/8013,20)
exten => 8013,n,Hangup()

; Outbound dialing context
exten => _X.,1,NoOp(Outbound call to ${EXTEN})
exten => _X.,n,Dial(${TRUNK}/${EXTEN},30)
exten => _X.,n,Hangup()
```

### 4. Configure SIP Endpoints

Edit `/etc/asterisk/sip.conf`:

```ini
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
```

### 5. Configure SIP Trunk (for outbound calls)

Add to `/etc/asterisk/sip.conf`:

```ini
[trunk]
type=peer
host=sip.provider.com
username=your_username
secret=your_password
fromuser=your_username
context=from-internal
disallow=all
allow=ulaw
allow=alaw
```

### 6. Start Asterisk

```bash
sudo systemctl start asterisk
sudo systemctl enable asterisk

# Check status
sudo asterisk -rx "core show version"
```

## Backend Configuration

### Environment Variables

Create/update `.env` file in `backend/`:

```env
# Asterisk AMI Settings
ASTERISK_HOST=localhost
ASTERISK_AMI_PORT=5038
ASTERISK_AMI_USERNAME=admin
ASTERISK_AMI_PASSWORD=amp111
ASTERISK_CONTEXT=from-internal
ASTERISK_TRUNK=SIP/trunk

# Enable real Asterisk (set to False to use mock mode for testing)
USE_MOCK_DIALER=False
```

### Update config.py

The configuration has been updated to use Asterisk settings:
- `ASTERISK_HOST`: Asterisk server IP/hostname
- `ASTERISK_AMI_PORT`: AMI port (default: 5038)
- `ASTERISK_AMI_USERNAME`: AMI username
- `ASTERISK_AMI_PASSWORD`: AMI password
- `ASTERISK_CONTEXT`: Dialplan context
- `ASTERISK_TRUNK`: SIP trunk name for outbound calls

## Testing the Integration

### 1. Test AMI Connection

```python
# test_asterisk.py
from app.services.asterisk_service import AsteriskService

async def test():
    service = AsteriskService()
    connected = await service.connect()
    print(f"Connected: {connected}")
    
    if connected:
        status = await service.get_channel_status("SIP/8013-00000001")
        print(f"Status: {status}")
        await service.disconnect()

import asyncio
asyncio.run(test())
```

### 2. Test Call Origination

The dialer will automatically:
1. Connect to Asterisk AMI
2. Authenticate
3. Originate calls using `Originate` action
4. Handle call events
5. Control calls (hangup, transfer, park)

## Call Flow

### Outbound Call Flow:

1. **Agent initiates call** via frontend
2. **Backend creates call record** in database
3. **AsteriskService.originate_call()** sends AMI Originate action:
   ```
   Action: Originate
   Channel: SIP/trunk/1234567890
   Context: from-internal
   Exten: 8013
   Priority: 1
   Async: true
   ```
4. **Asterisk dials** the phone number via SIP trunk
5. **Asterisk connects** agent extension when call is answered
6. **Call events** are tracked and status updated

### Call Control:

- **Hangup**: Uses AMI `Hangup` action
- **Transfer**: Uses AMI `Redirect` action
- **Park**: Uses AMI `Park` action
- **Recording**: Uses AMI `Monitor` action

## Troubleshooting

### Connection Issues

1. **Check AMI is enabled:**
   ```bash
   sudo asterisk -rx "manager show settings"
   ```

2. **Test AMI connection:**
   ```bash
   telnet localhost 5038
   # Should see: "Asterisk Call Manager/1.x"
   ```

3. **Check firewall:**
   ```bash
   sudo ufw allow 5038/tcp
   ```

### Call Issues

1. **Check dialplan:**
   ```bash
   sudo asterisk -rx "dialplan show from-internal"
   ```

2. **Check SIP peers:**
   ```bash
   sudo asterisk -rx "sip show peers"
   ```

3. **Monitor logs:**
   ```bash
   tail -f /var/log/asterisk/full
   ```

## Features Implemented

✅ **Asterisk AMI Integration**
- Connection and authentication
- Call origination
- Call hangup
- Call transfer
- Call parking
- Channel status monitoring
- Call recording (monitor)

✅ **Full Call Control**
- Manual dialing
- Real-time call status
- Call duration tracking
- Call history

✅ **Error Handling**
- Connection retry logic
- Proper error messages
- Fallback to mock mode

## Next Steps

1. **Call Event Handling**: Implement AMI event listener for real-time updates
2. **CDR Integration**: Parse Asterisk CDR for call details
3. **Recording Management**: Store and manage call recordings
4. **Queue Management**: Implement call queues for automated dialing
5. **SIP Registration**: Auto-register SIP endpoints

## Security Notes

- Change default AMI password
- Restrict AMI access by IP
- Use TLS for AMI in production
- Secure SIP trunk credentials
- Enable firewall rules
