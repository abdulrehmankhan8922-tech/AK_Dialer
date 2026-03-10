#!/usr/bin/env python3
"""
Test script to verify Asterisk AMI connection and dialing
Run this to diagnose why calls aren't working
"""
import asyncio
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.asterisk_service import AsteriskService
from app.core.config import settings


async def test_ami_connection():
    """Test AMI connection"""
    print("=" * 60)
    print("Testing Asterisk AMI Connection")
    print("=" * 60)
    print(f"Host: {settings.ASTERISK_HOST}")
    print(f"Port: {settings.ASTERISK_AMI_PORT}")
    print(f"Username: {settings.ASTERISK_AMI_USERNAME}")
    print(f"Password: {'*' * len(settings.ASTERISK_AMI_PASSWORD)}")
    print()
    
    service = AsteriskService()
    connected = await service.connect()
    
    if connected:
        print("✅ AMI Connection: SUCCESS")
        return True
    else:
        print("❌ AMI Connection: FAILED")
        return False


async def test_originate(agent_extension: str, customer_number: str):
    """Test originate call"""
    print("=" * 60)
    print("Testing Originate Call")
    print("=" * 60)
    print(f"Agent Extension: {agent_extension}")
    print(f"Customer Number: {customer_number}")
    print(f"USE_MOCK_DIALER: {settings.USE_MOCK_DIALER}")
    print()
    
    if settings.USE_MOCK_DIALER:
        print("⚠️  WARNING: USE_MOCK_DIALER is True!")
        print("   Calls will be simulated, not real.")
        print("   Set USE_MOCK_DIALER=False in .env to make real calls.")
        print()
    
    service = AsteriskService()
    
    # Connect first
    if not await service.connect():
        print("❌ Cannot test originate - AMI connection failed")
        return False
    
    # Test originate
    agent_channel = f"SIP/{agent_extension}"
    customer_channel = f"{settings.ASTERISK_TRUNK}/{customer_number}"
    
    print(f"Agent Channel: {agent_channel}")
    print(f"Customer Channel: {customer_channel}")
    print()
    
    result = await service.originate_call_with_dial(
        channel=agent_channel,
        application="Dial",
        application_data=f"{customer_channel},30",
        caller_id=f"Test <{customer_number}>",
        timeout=30000
    )
    
    print(f"Result: {result}")
    print()
    
    if result.get("success"):
        print("✅ Originate: SUCCESS")
        print(f"   Action ID: {result.get('action_id')}")
        print("   X-Lite should ring now!")
        return True
    else:
        print("❌ Originate: FAILED")
        print(f"   Error: {result.get('message')}")
        return False


async def main():
    """Main test function"""
    print("\n" + "=" * 60)
    print("Asterisk Dialing Diagnostic Test")
    print("=" * 60 + "\n")
    
    # Test 1: AMI Connection
    connected = await test_ami_connection()
    print()
    
    if not connected:
        print("❌ Cannot proceed - AMI connection failed")
        print("\nTroubleshooting:")
        print("1. Check Asterisk is running: sudo systemctl status asterisk")
        print("2. Check AMI is enabled: sudo asterisk -rx 'manager show connected'")
        print("3. Check firewall allows port 5038")
        print("4. Check credentials in .env file")
        return
    
    # Test 2: Originate (optional - requires agent extension)
    if len(sys.argv) > 1:
        agent_ext = sys.argv[1] if len(sys.argv) > 1 else "8014"
        customer_num = sys.argv[2] if len(sys.argv) > 2 else "1234567890"
        
        print()
        await test_originate(agent_ext, customer_num)
    else:
        print("\nTo test originate, run:")
        print(f"  python {sys.argv[0]} <agent_extension> <customer_number>")
        print(f"  Example: python {sys.argv[0]} 8014 1234567890")


if __name__ == "__main__":
    asyncio.run(main())
