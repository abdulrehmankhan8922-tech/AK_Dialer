#!/usr/bin/env python3
"""Update agent password in database"""
import sys
sys.path.insert(0, 'backend')

from app.core.database import SessionLocal
from app.models.agent import Agent
from app.core.security import get_password_hash

def update_agent_password(username: str, new_password: str):
    """Update agent password"""
    db = SessionLocal()
    try:
        agent = db.query(Agent).filter(Agent.username == username).first()
        if not agent:
            print(f"❌ Agent '{username}' not found!")
            return False
        
        print(f"✓ Found agent: {agent.username}")
        print(f"  Updating password...")
        
        # Update password hash
        agent.password_hash = get_password_hash(new_password)
        db.commit()
        
        print(f"✓ Password updated successfully!")
        print(f"  Username: {agent.username}")
        print(f"  New password: {new_password}")
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python update_agent_password.py <username> <new_password>")
        print("\nExamples:")
        print("  python update_agent_password.py 8013 'Agent@2024!Pass123#'")
        print("  python update_agent_password.py admin 'Admin@2024!Secure#'")
        sys.exit(1)
    
    username = sys.argv[1]
    new_password = sys.argv[2]
    
    print(f"Updating password for agent: {username}")
    print(f"New password: {new_password}")
    print()
    
    success = update_agent_password(username, new_password)
    
    if success:
        print("\n✓ Done! You can now login with the new password.")
    else:
        print("\n❌ Failed to update password.")
        sys.exit(1)
