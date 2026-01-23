"""Test login functionality"""
import sys
sys.path.insert(0, '.')

from app.core.database import SessionLocal
from app.models.agent import Agent
from app.core.security import verify_password, get_password_hash

db = SessionLocal()

# Check if agent exists
agent = db.query(Agent).filter(Agent.username == "8013").first()
if agent:
    print(f"[OK] Agent found: {agent.username}")
    print(f"  Phone Extension: {agent.phone_extension}")
    print(f"  Password Hash: {agent.password_hash[:50]}...")
    
    # Test password verification
    test_password = "password"
    is_valid = verify_password(test_password, agent.password_hash)
    print(f"  Password 'password' valid: {is_valid}")
    
    if not is_valid:
        print("\n⚠️ Password hash doesn't match!")
        print("  Updating password hash...")
        agent.password_hash = get_password_hash(test_password)
        db.commit()
        print("  [OK] Password hash updated")
        print(f"  New hash: {agent.password_hash[:50]}...")
        is_valid = verify_password(test_password, agent.password_hash)
        print(f"  Verification after update: {is_valid}")
else:
    print("[ERROR] Agent '8013' not found!")
    print("  Creating agent...")
    from app.models.agent import AgentStatus
    agent = Agent(
        username="8013",
        password_hash=get_password_hash("password"),
        phone_extension="8013",
        full_name="Test Agent",
        status=AgentStatus.LOGGED_OUT,
        is_admin=0
    )
    db.add(agent)
    db.commit()
    print("  [OK] Agent created!")

db.close()
print("\n[OK] Test complete!")
