# Naya Tel SIP Trunk Setup Guide

## Step 1: Configure Naya Tel SIP Trunk

On your server, edit the PJSIP configuration:

```bash
sudo nano /etc/asterisk/pjsip.conf
```

Add at the end of the file:

```ini
; Naya Tel SIP Trunk Configuration
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
direct_media=no

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

**Replace:**
- `YOUR_NAYA_TEL_PASSWORD` - Your Naya Tel SIP password
- `YOUR_NAYA_TEL_USERNAME` - Your Naya Tel SIP username
- `YOUR_NAYA_TEL_SERVER` - Naya Tel SIP server address (ask Naya Tel for this)

## Step 2: Update Dialplan

```bash
sudo nano /etc/asterisk/extensions.conf
```

Update the configuration:

```ini
[globals]
TRUNK=PJSIP/trunk

[from-internal]
; Agent extensions
exten => 8013,1,NoOp(Calling Agent 8013)
exten => 8013,n,Dial(PJSIP/8013,30)
exten => 8013,n,Hangup()

exten => 8014,1,NoOp(Calling Agent 8014)
exten => 8014,n,Dial(PJSIP/8014,30)
exten => 8014,n,Hangup()

; Test extension
exten => 9000,1,NoOp(Calling Test Extension 9000)
exten => 9000,n,Dial(PJSIP/9000,30)
exten => 9000,n,Hangup()

; Outbound calls - Route to Naya Tel trunk with caller ID 0516125672
exten => _X.,1,NoOp(Outbound call to ${EXTEN} from ${CALLERID(num)})
exten => _X.,n,Set(CALLERID(num)=0516125672)
exten => _X.,n,Set(CALLERID(name)=Your Company Name)
exten => _X.,n,Dial(${TRUNK}/${EXTEN},60)
exten => _X.,n,Hangup()

[from-trunk]
; Incoming calls from Naya Tel trunk
; Route to available agents
exten => _X.,1,NoOp(Incoming call to ${EXTEN} from ${CALLERID(num)})
exten => _X.,n,Set(CALLERID(num)=${CALLERID(num)})
; Ring agent 8013 first, then 8014
exten => _X.,n,Dial(PJSIP/8013,20)
exten => _X.,n,Dial(PJSIP/8014,20)
exten => _X.,n,Hangup()
```

## Step 3: Reload Asterisk

```bash
# Reload PJSIP
sudo asterisk -rx "module reload res_pjsip.so"

# Reload dialplan
sudo asterisk -rx "dialplan reload"

# Verify trunk is registered
sudo asterisk -rx "pjsip show endpoint trunk"
```

## Step 4: Verify Configuration

```bash
# Check trunk status
sudo asterisk -rx "pjsip show endpoint trunk" | grep -E "Endpoint:|Contact:"

# Should show "Available" if registered
```

## Notes

- **Outbound Caller ID**: Set to `0516125672` in dialplan
- **Inbound Routing**: Calls will ring agent 8013, then 8014
- **Naya Tel Server**: Ask Naya Tel for their SIP server address
