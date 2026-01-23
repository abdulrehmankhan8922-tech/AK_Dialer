from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.agent import AgentResponse, AgentStatusUpdate, AgentSessionResponse
from app.models.agent import Agent, AgentSession, AgentStatus
from app.api.deps import get_current_agent_id

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.get("/me", response_model=AgentResponse)
async def get_current_agent(db: Session = Depends(get_db), agent_id: int = Depends(get_current_agent_id)):
    """Get current agent info"""
    
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    return AgentResponse.model_validate(agent)


@router.get("/session", response_model=AgentSessionResponse)
async def get_current_session(db: Session = Depends(get_db), agent_id: int = Depends(get_current_agent_id)):
    """Get current agent session"""
    
    session = db.query(AgentSession).filter(
        AgentSession.agent_id == agent_id,
        AgentSession.logout_time.is_(None)
    ).order_by(AgentSession.login_time.desc()).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return AgentSessionResponse.model_validate(session)


@router.post("/status")
async def update_status(
    status_update: AgentStatusUpdate,
    db: Session = Depends(get_db),
    agent_id: int = Depends(get_current_agent_id)
):
    """Update agent status"""
    
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    agent.status = status_update.status
    db.commit()
    
    # Update session status
    session = db.query(AgentSession).filter(
        AgentSession.agent_id == agent_id,
        AgentSession.logout_time.is_(None)
    ).first()
    if session:
        session.status = status_update.status
        db.commit()
    
    return {"success": True, "status": status_update.status.value}
