from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, case
from typing import List
from datetime import datetime, timezone
from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.agent import Agent
from app.models.call import Call, CallDirection, CallStatus
from app.models.campaign import Campaign, CampaignStatus, DialMethod
from app.schemas.agent import AgentCreate, AgentUpdate
from app.schemas.campaign import CampaignCreate, CampaignResponse, CampaignList
from app.api.deps import get_current_agent_id
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])


def check_admin(db: Session, agent_id: int):
    """Check if agent is admin"""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent or agent.is_admin != 1:
        raise HTTPException(status_code=403, detail="Admin access required")
    return agent


@router.get("/agents")
async def list_all_agents(
    db: Session = Depends(get_db),
    agent_id: int = Depends(get_current_agent_id)
):
    """List all agents (admin only)"""
    check_admin(db, agent_id)
    
    try:
        agents = db.query(Agent).order_by(Agent.created_at.desc()).all()
        return [
            {
                "id": agent.id,
                "username": agent.username,
                "full_name": agent.full_name,
                "phone_extension": agent.phone_extension,
                "status": agent.status,  # Already a string from database
                "is_admin": agent.is_admin == 1,
                "created_at": agent.created_at.isoformat() if agent.created_at else None
            }
            for agent in agents
        ]
    except Exception as e:
        logger.error(f"Error listing agents: {e}")
        raise HTTPException(status_code=500, detail="Error fetching agents")


@router.post("/agents", status_code=status.HTTP_201_CREATED)
async def create_agent(
    agent_data: AgentCreate,
    db: Session = Depends(get_db),
    agent_id: int = Depends(get_current_agent_id)
):
    """Create a new agent (admin only)"""
    check_admin(db, agent_id)
    
    try:
        # Check if username already exists
        existing_username = db.query(Agent).filter(Agent.username == agent_data.username).first()
        if existing_username:
            raise HTTPException(status_code=400, detail="Username already exists")
        
        # Check if phone_extension already exists
        existing_extension = db.query(Agent).filter(Agent.phone_extension == agent_data.phone_extension).first()
        if existing_extension:
            raise HTTPException(status_code=400, detail="Phone extension already exists")
        
        # Hash password
        password_hash = get_password_hash(agent_data.password)
        
        # Create new agent
        new_agent = Agent(
            username=agent_data.username,
            phone_extension=agent_data.phone_extension,
            full_name=agent_data.full_name,
            password_hash=password_hash,
            is_admin=agent_data.is_admin,
            status="logged_out"
        )
        
        db.add(new_agent)
        db.commit()
        db.refresh(new_agent)
        
        return {
            "id": new_agent.id,
            "username": new_agent.username,
            "phone_extension": new_agent.phone_extension,
            "full_name": new_agent.full_name,
            "status": new_agent.status,
            "is_admin": new_agent.is_admin == 1,
            "created_at": new_agent.created_at.isoformat() if new_agent.created_at else None
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating agent: {e}")
        raise HTTPException(status_code=500, detail="Error creating agent")


@router.put("/agents/{agent_id}")
async def update_agent(
    agent_id: int,
    agent_update: AgentUpdate,
    db: Session = Depends(get_db),
    current_agent_id: int = Depends(get_current_agent_id)
):
    """Update an agent (admin only)"""
    check_admin(db, current_agent_id)
    
    try:
        agent = db.query(Agent).filter(Agent.id == agent_id).first()
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # Check if username is being changed and already exists
        if agent_update.username and agent_update.username != agent.username:
            existing_username = db.query(Agent).filter(Agent.username == agent_update.username).first()
            if existing_username:
                raise HTTPException(status_code=400, detail="Username already exists")
            agent.username = agent_update.username
        
        # Check if phone_extension is being changed and already exists
        if agent_update.phone_extension and agent_update.phone_extension != agent.phone_extension:
            existing_extension = db.query(Agent).filter(Agent.phone_extension == agent_update.phone_extension).first()
            if existing_extension:
                raise HTTPException(status_code=400, detail="Phone extension already exists")
            agent.phone_extension = agent_update.phone_extension
        
        # Update other fields
        if agent_update.full_name is not None:
            agent.full_name = agent_update.full_name
        
        if agent_update.password:
            agent.password_hash = get_password_hash(agent_update.password)
        
        if agent_update.is_admin is not None:
            agent.is_admin = agent_update.is_admin
        
        db.commit()
        db.refresh(agent)
        
        return {
            "id": agent.id,
            "username": agent.username,
            "phone_extension": agent.phone_extension,
            "full_name": agent.full_name,
            "status": agent.status,
            "is_admin": agent.is_admin == 1,
            "created_at": agent.created_at.isoformat() if agent.created_at else None
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating agent: {e}")
        raise HTTPException(status_code=500, detail="Error updating agent")


@router.get("/stats/all")
async def get_all_agents_stats(
    db: Session = Depends(get_db),
    agent_id: int = Depends(get_current_agent_id)
):
    """Get statistics for all agents (admin only) - OPTIMIZED"""
    check_admin(db, agent_id)
    
    # Use timezone-aware datetime
    now = datetime.now(timezone.utc)
    today = now.date()
    today_start = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)
    
    try:
        # First, get all agents
        all_agents = db.query(Agent).all()
        
        # Get stats for agents with calls (today only)
        stats_query = db.query(
            Agent.id,
            Agent.username,
            Agent.full_name,
            Agent.status,
            # Count inbound calls
            func.count(case((Call.direction == CallDirection.INBOUND, Call.id))).label('inbound_calls'),
            # Count outbound calls
            func.count(case((Call.direction == CallDirection.OUTBOUND, Call.id))).label('outbound_calls'),
            # Count total calls
            func.count(Call.id).label('total_calls'),
            # Count abandoned calls
            func.count(case((
                Call.status.in_([CallStatus.NO_ANSWER, CallStatus.BUSY, CallStatus.FAILED]),
                Call.id
            ))).label('abandoned_calls'),
            # Average call duration
            func.avg(case((Call.duration > 0, Call.duration))).label('avg_duration')
        ).outerjoin(
            Call, 
            (Call.agent_id == Agent.id) & (Call.start_time >= today_start)
        ).group_by(
            Agent.id,
            Agent.username,
            Agent.full_name,
            Agent.status
        ).all()
        
        # Create a dictionary of stats by agent_id
        stats_by_agent = {}
        for row in stats_query:
            total_calls = row.total_calls or 0
            abandoned_calls = row.abandoned_calls or 0
            inbound_calls = row.inbound_calls or 0
            outbound_calls = row.outbound_calls or 0
            
            stats_by_agent[row.id] = {
                "agent_id": row.id,
                "username": row.username,
                "full_name": row.full_name or row.username,
                "status": row.status,
                "inbound_calls": inbound_calls,
                "outbound_calls": outbound_calls,
                "total_calls": total_calls,
                "abandoned_calls": abandoned_calls,
                "avg_call_duration": int(row.avg_duration) if row.avg_duration else 0,
                "answer_rate": round(((total_calls - abandoned_calls) / total_calls * 100) if total_calls > 0 else 0, 2)
            }
        
        # Build stats list with all agents (including those with no calls)
        stats = []
        for agent in all_agents:
            if agent.id in stats_by_agent:
                stats.append(stats_by_agent[agent.id])
            else:
                # Agent with no calls today
                stats.append({
                    "agent_id": agent.id,
                    "username": agent.username,
                    "full_name": agent.full_name or agent.username,
                    "status": agent.status,
                    "inbound_calls": 0,
                    "outbound_calls": 0,
                    "total_calls": 0,
                    "abandoned_calls": 0,
                    "avg_call_duration": 0,
                    "answer_rate": 0
                })
        
        return stats
    except Exception as e:
        logger.error(f"Error fetching agent stats: {e}")
        raise HTTPException(status_code=500, detail="Error fetching statistics")


@router.get("/stats/summary")
async def get_summary_stats(
    db: Session = Depends(get_db),
    agent_id: int = Depends(get_current_agent_id)
):
    """Get overall summary statistics (admin only) - OPTIMIZED"""
    check_admin(db, agent_id)
    
    # Use timezone-aware datetime
    now = datetime.now(timezone.utc)
    today = now.date()
    today_start = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)
    
    try:
        # Optimized: Single query for all call statistics
        call_stats = db.query(
            func.count(case((Call.direction == CallDirection.INBOUND, Call.id))).label('inbound'),
            func.count(case((Call.direction == CallDirection.OUTBOUND, Call.id))).label('outbound'),
            func.count(case((
                Call.status.in_([CallStatus.NO_ANSWER, CallStatus.BUSY, CallStatus.FAILED]),
                Call.id
            ))).label('abandoned')
        ).filter(
            Call.start_time >= today_start
        ).first()
        
        total_inbound = call_stats.inbound or 0
        total_outbound = call_stats.outbound or 0
        total_calls = total_inbound + total_outbound
        total_abandoned = call_stats.abandoned or 0
        
        # Agent counts
        agent_counts = db.query(
            func.count(case((
                Agent.status.in_(["available", "in_call", "paused"]),
                Agent.id
            ))).label('active'),
            func.count(Agent.id).label('total')
        ).first()
        
        active_agents = agent_counts.active or 0
        total_agents = agent_counts.total or 0
        
        return {
            "total_inbound_calls": total_inbound,
            "total_outbound_calls": total_outbound,
            "total_calls": total_calls,
            "total_abandoned_calls": total_abandoned,
            "active_agents": active_agents,
            "total_agents": total_agents,
            "overall_answer_rate": round(((total_calls - total_abandoned) / total_calls * 100) if total_calls > 0 else 0, 2)
        }
    except Exception as e:
        logger.error(f"Error fetching summary stats: {e}")
        raise HTTPException(status_code=500, detail="Error fetching summary statistics")


# Campaign CRUD endpoints
@router.get("/campaigns", response_model=CampaignList)
async def list_all_campaigns(
    db: Session = Depends(get_db),
    agent_id: int = Depends(get_current_agent_id)
):
    """List all campaigns (admin only)"""
    check_admin(db, agent_id)
    
    campaigns = db.query(Campaign).order_by(Campaign.created_at.desc()).all()
    return CampaignList(campaigns=[CampaignResponse.model_validate(c) for c in campaigns])


@router.post("/campaigns", response_model=CampaignResponse)
async def create_campaign(
    campaign: CampaignCreate,
    db: Session = Depends(get_db),
    agent_id: int = Depends(get_current_agent_id)
):
    """Create a new campaign (admin only)"""
    check_admin(db, agent_id)
    
    # Check if code already exists
    existing = db.query(Campaign).filter(Campaign.code == campaign.code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Campaign with code '{campaign.code}' already exists")
    
    db_campaign = Campaign(
        name=campaign.name,
        code=campaign.code,
        description=campaign.description,
        status=campaign.status.value,
        dial_method=campaign.dial_method.value
    )
    db.add(db_campaign)
    db.commit()
    db.refresh(db_campaign)
    return CampaignResponse.model_validate(db_campaign)


@router.put("/campaigns/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(
    campaign_id: int,
    campaign: CampaignCreate,
    db: Session = Depends(get_db),
    agent_id: int = Depends(get_current_agent_id)
):
    """Update a campaign (admin only)"""
    check_admin(db, agent_id)
    
    db_campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not db_campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Check if code is being changed and if new code already exists
    if campaign.code != db_campaign.code:
        existing = db.query(Campaign).filter(Campaign.code == campaign.code).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Campaign with code '{campaign.code}' already exists")
    
    db_campaign.name = campaign.name
    db_campaign.code = campaign.code
    db_campaign.description = campaign.description
    db_campaign.status = campaign.status.value
    db_campaign.dial_method = campaign.dial_method.value
    
    db.commit()
    db.refresh(db_campaign)
    return CampaignResponse.model_validate(db_campaign)


@router.delete("/campaigns/{campaign_id}")
async def delete_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
    agent_id: int = Depends(get_current_agent_id)
):
    """Delete a campaign (admin only)"""
    check_admin(db, agent_id)
    
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Check if campaign has associated contacts or calls
    from app.models.contact import Contact
    from app.models.call import Call
    
    contact_count = db.query(Contact).filter(Contact.campaign_id == campaign_id).count()
    call_count = db.query(Call).filter(Call.campaign_id == campaign_id).count()
    
    if contact_count > 0 or call_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete campaign. It has {contact_count} contacts and {call_count} calls associated with it."
        )
    
    db.delete(campaign)
    db.commit()
    return {"success": True, "message": f"Campaign '{campaign.name}' deleted successfully"}
