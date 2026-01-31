"""
Script to diagnose call failures
"""
import asyncio
from app.core.config import settings
from app.services.asterisk_service import AsteriskService

async def diagnose():
    print("=" * 60)
    print("CALL FAILURE DIAGNOSIS")
    print("=" * 60)
    print()
    
    print("[1] Checking Configuration:")
    print(f"  ASTERISK_TRUNK: {settings.ASTERISK_TRUNK}")
    print(f"  ASTERISK_CONTEXT: {settings.ASTERISK_CONTEXT}")
    print()
    
    service = AsteriskService()
    
    print("[2] Testing AMI Connection...")
    connected = await service.connect()
    if not connected:
        print("  [FAILED] Cannot connect to Asterisk AMI")
        return
    print("  [OK] Connected to Asterisk AMI")
    print()
    
    print("[3] Checking PJSIP Endpoints...")
    result = await service.send_action("PJSIPShowEndpoints")
    if result.get("Response") == "Success":
        print("  [OK] Can query endpoints")
    else:
        print(f"  [WARNING] {result.get('Message', 'Unknown')}")
    print()
    
    print("[4] Checking if Trunk Exists...")
    # Check if trunk endpoint exists
    result = await service.send_action("PJSIPShowEndpoints")
    # This will show all endpoints
    print("  Note: Check Asterisk CLI: 'pjsip show endpoints' to see if 'trunk' exists")
    print()
    
    print("[5] Testing Originate (will likely fail without trunk)...")
    test_result = await service.originate_call(
        channel=f"{settings.ASTERISK_TRUNK}/1234567890",
        context=settings.ASTERISK_CONTEXT,
        exten="8013",
        priority=1,
        timeout=5000
    )
    
    if test_result.get("success"):
        print("  [OK] Originate succeeded")
    else:
        print(f"  [FAILED] Originate failed: {test_result.get('message', 'Unknown error')}")
        print("  This is likely why calls are failing!")
    print()
    
    await service.disconnect()
    
    print("=" * 60)
    print("DIAGNOSIS COMPLETE")
    print("=" * 60)
    print()
    print("Common Issues:")
    print("1. No SIP trunk configured in /etc/asterisk/pjsip.conf")
    print("2. Agent softphone (8013) not registered")
    print("3. Dialplan not configured for outbound calls")
    print("4. Trunk endpoint 'trunk' doesn't exist")

if __name__ == "__main__":
    asyncio.run(diagnose())
