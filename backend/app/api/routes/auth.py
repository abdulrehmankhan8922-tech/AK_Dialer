from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import verify_password, create_access_token, decode_access_token
from app.schemas.auth import LoginRequest, LoginResponse
from app.models.agent import Agent, AgentSession, AgentStatus
from app.models.campaign import Campaign
from app.api.deps import security, get_current_agent_id
import uuid
from datetime import timedelta

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    """User-based login - username can match either username or phone_extension"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # Try to find agent by username or phone_extension
        agent = db.query(Agent).filter(
            (Agent.username == login_data.username) | (Agent.phone_extension == login_data.username)
        ).first()
        
        if not agent:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password"
            )
        
        # Verify password
        if not verify_password(login_data.password, agent.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password"
            )
        
        # Get campaign if provided (optional for admins)
        campaign = None
        campaign_id = None
        campaign_code = None
        
        if login_data.campaign:
            campaign = db.query(Campaign).filter(Campaign.code == login_data.campaign).first()
            if not campaign:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Campaign not found"
                )
            campaign_id = campaign.id
            campaign_code = campaign.code
        # Campaign is optional - if not provided and agent is not admin, use first available campaign
        elif agent.is_admin == 0:
            # For regular agents, try to get first active campaign
            campaign = db.query(Campaign).filter(Campaign.status == "active").first()
            if campaign:
                campaign_id = campaign.id
                campaign_code = campaign.code
        
        # Create session
        session_id = str(uuid.uuid4())
        agent_session = AgentSession(
            agent_id=agent.id,
            campaign_id=campaign_id,
            session_id=session_id,
            status=AgentStatus.AVAILABLE.value
        )
        db.add(agent_session)
        
        # Update agent status
        agent.status = AgentStatus.AVAILABLE.value
        db.commit()
        
        # Create access token
        access_token_expires = timedelta(minutes=1440)  # 24 hours
        access_token = create_access_token(
            data={"sub": agent.username, "agent_id": agent.id, "session_id": session_id},
            expires_delta=access_token_expires
        )
        
        return LoginResponse(
            access_token=access_token,
            token_type="bearer",
            agent_id=agent.id,
            username=agent.username,
            session_id=session_id,
            campaign_id=campaign_id,
            campaign_code=campaign_code,
            is_admin=bool(agent.is_admin == 1)
        )
    except HTTPException as he:
        db.rollback()
        raise he
    except Exception as e:
        import traceback
        error_msg = f"{type(e).__name__}: {str(e)}"
        error_trace = traceback.format_exc()
        print(f"\n=== LOGIN ERROR ===")
        print(f"Error: {error_msg}")
        print(f"Traceback:\n{error_trace}")
        print(f"===================\n")
        try:
            db.rollback()
        except:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {error_msg}"
        )


@router.post("/logout")
async def logout(
    db: Session = Depends(get_db),
    agent_id: int = Depends(get_current_agent_id)
):
    """Agent logout"""
    
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if agent:
        agent.status = AgentStatus.LOGGED_OUT.value
        # Update session
        session = db.query(AgentSession).filter(
            AgentSession.agent_id == agent_id,
            AgentSession.logout_time.is_(None)
        ).first()
        if session:
            from datetime import datetime
            session.logout_time = datetime.utcnow()
            session.status = AgentStatus.LOGGED_OUT.value
        db.commit()
    
    return {"message": "Logged out successfully"}
