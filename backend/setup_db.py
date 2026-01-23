"""
Setup script to create initial database and test data
Run: python setup_db.py
"""
from app.core.database import engine, Base, SessionLocal
from app.models.agent import Agent, AgentStatus
from app.models.campaign import Campaign, CampaignStatus, DialMethod
from app.models.contact import Contact, ContactStatus, GenderType
from app.core.security import get_password_hash


def setup_database():
    """Create database tables"""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("[OK] Database tables created")


def create_test_agent():
    """Create a test agent"""
    db = SessionLocal()
    try:
        # Check if agent already exists
        existing = db.query(Agent).filter(Agent.username == "8013").first()
        if existing:
            print("[OK] Test agent already exists")
            return existing
        
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
        db.refresh(agent)
        print(f"[OK] Created test agent: {agent.username} (password: password)")
        return agent
    except Exception as e:
        print(f"Error creating test agent: {e}")
        db.rollback()
        return None
    finally:
        db.close()


def create_test_campaign():
    """Create a test campaign"""
    db = SessionLocal()
    try:
        # Check if campaign already exists
        existing = db.query(Campaign).filter(Campaign.code == "J7GC4").first()
        if existing:
            print("[OK] Test campaign already exists")
            return existing
        
        campaign = Campaign(
            name="J7G Campaign 4",
            code="J7GC4",
            description="Test campaign",
            status=CampaignStatus.ACTIVE,
            dial_method=DialMethod.MANUAL
        )
        db.add(campaign)
        db.commit()
        db.refresh(campaign)
        print(f"[OK] Created test campaign: {campaign.code} - {campaign.name}")
        return campaign
    except Exception as e:
        print(f"Error creating test campaign: {e}")
        db.rollback()
        return None
    finally:
        db.close()


def create_admin_user():
    """Create an admin user"""
    db = SessionLocal()
    try:
        existing = db.query(Agent).filter(Agent.username == "admin").first()
        if existing:
            print("[OK] Admin user already exists")
            return existing
        
        admin = Agent(
            username="admin",
            password_hash=get_password_hash("admin"),
            phone_extension="admin",
            full_name="Administrator",
            status=AgentStatus.LOGGED_OUT,
            is_admin=1
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
        print(f"[OK] Created admin user: {admin.username} (password: admin)")
        return admin
    except Exception as e:
        print(f"Error creating admin user: {e}")
        db.rollback()
        return None
    finally:
        db.close()


if __name__ == "__main__":
    print("=" * 50)
    print("Grainbox Dialer - Database Setup")
    print("=" * 50)
    
    setup_database()
    create_test_agent()
    create_admin_user()
    create_test_campaign()
    
    print("=" * 50)
    print("[OK] Database setup complete!")
    print("=" * 50)
    print("\nTest Credentials:")
    print("  Phone/User Login: 8013")
    print("  Password: password")
    print("  Campaign: J7GC4")
    print("\nAdmin Credentials:")
    print("  Username: admin")
    print("  Password: admin")
    print("=" * 50)
