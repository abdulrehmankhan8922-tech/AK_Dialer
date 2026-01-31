"""
Test script to verify Asterisk AMI connection configuration
"""
import asyncio
import sys
from app.core.config import settings
from app.services.asterisk_service import AsteriskService
from app.services.ami_event_listener import ami_event_listener

async def test_connection():
    """Test Asterisk AMI connection"""
    print("=" * 60)
    print("ASTERISK CONNECTION TEST")
    print("=" * 60)
    print()
    
    # Check configuration
    print("[CONFIG] Configuration:")
    print(f"  USE_MOCK_DIALER: {settings.USE_MOCK_DIALER}")
    print(f"  ASTERISK_HOST: {settings.ASTERISK_HOST}")
    print(f"  ASTERISK_AMI_PORT: {settings.ASTERISK_AMI_PORT}")
    print(f"  ASTERISK_AMI_USERNAME: {settings.ASTERISK_AMI_USERNAME}")
    print(f"  ASTERISK_AMI_PASSWORD: {'*' * len(settings.ASTERISK_AMI_PASSWORD)}")
    print(f"  ASTERISK_CONTEXT: {settings.ASTERISK_CONTEXT}")
    print(f"  ASTERISK_TRUNK: {settings.ASTERISK_TRUNK}")
    print()
    
    # Check if mock dialer is enabled
    if settings.USE_MOCK_DIALER:
        print("[ERROR] USE_MOCK_DIALER is set to True")
        print("   The backend will NOT connect to Asterisk!")
        print("   Set USE_MOCK_DIALER=False in .env file")
        return False
    
    print("[OK] USE_MOCK_DIALER is False - Asterisk connection enabled")
    print()
    
    # Test connection
    print("[TEST] Testing AMI Connection...")
    service = AsteriskService()
    
    try:
        connected = await service.connect()
        if connected:
            print("[SUCCESS] Connected to Asterisk AMI!")
            print(f"   Host: {settings.ASTERISK_HOST}:{settings.ASTERISK_AMI_PORT}")
            
            # Test a simple action
            print()
            print("[TEST] Testing AMI Action (Get Version)...")
            result = await service.send_action("CoreShowVersion")
            if result.get("Response") == "Success":
                version = result.get("Version", "Unknown")
                print(f"[OK] Asterisk Version: {version}")
            else:
                print(f"[WARNING] Version check failed: {result.get('Message', 'Unknown')}")
            
            await service.disconnect()
            print()
            print("=" * 60)
            print("[SUCCESS] ALL TESTS PASSED - Asterisk connection is working!")
            print("=" * 60)
            return True
        else:
            print("[FAILED] Could not connect to Asterisk AMI")
            print("   Check:")
            print("   1. Asterisk is running")
            print("   2. AMI is enabled in /etc/asterisk/manager.conf")
            print("   3. Port 5038 is accessible")
            print("   4. Username and password are correct")
            return False
            
    except Exception as e:
        print(f"[ERROR] {e}")
        print()
        print("Troubleshooting:")
        print("1. Is Asterisk running? (sudo systemctl status asterisk)")
        print("2. Is AMI enabled? (sudo asterisk -rx 'manager show settings')")
        print("3. Check firewall: (sudo ufw status | grep 5038)")
        print("4. Test connection: (telnet localhost 5038)")
        return False

if __name__ == "__main__":
    result = asyncio.run(test_connection())
    sys.exit(0 if result else 1)
