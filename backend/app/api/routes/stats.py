from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from datetime import datetime, timezone
from app.core.database import get_db
from app.models.call import Call, CallDirection, CallStatus
from app.models.agent import AgentSession
from app.api.deps import get_current_agent_id
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/stats", tags=["stats"])


def format_time(seconds: int) -> str:
    """Format seconds to HH:MM:SS"""
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    return f"{int(hours):02d}:{int(minutes):02d}:{int(secs):02d}"


@router.get("/today")
async def get_today_stats(
    db: Session = Depends(get_db),
    agent_id: int = Depends(get_current_agent_id)
):
    """Get today's statistics for agent - OPTIMIZED"""
    try:
        # Use timezone-aware datetime
        now = datetime.now(timezone.utc)
        today = now.date()
        today_start = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)
        
        # Optimized: Single query for all call statistics
        call_stats = db.query(
            func.count(case((Call.direction == CallDirection.INBOUND, Call.id))).label('inbound'),
            func.count(case((Call.direction == CallDirection.OUTBOUND, Call.id))).label('outbound'),
            func.count(case((
                Call.status.in_([CallStatus.NO_ANSWER, CallStatus.BUSY, CallStatus.FAILED]),
                Call.id
            ))).label('abandoned')
        ).filter(
            Call.agent_id == agent_id,
            Call.start_time >= today_start
        ).first()
        
        inbound_calls = call_stats.inbound or 0
        outbound_calls = call_stats.outbound or 0
        total_calls = inbound_calls + outbound_calls
        abandoned_calls = call_stats.abandoned or 0
        
        # Get session info
        session = db.query(AgentSession).filter(
            AgentSession.agent_id == agent_id,
            AgentSession.logout_time.is_(None)
        ).order_by(AgentSession.login_time.desc()).first()
        
        login_time = 0
        break_time = 0
        
        if session:
            # Use timezone-aware datetime for subtraction
            login_duration = (now - session.login_time).total_seconds()
            login_time = int(login_duration)
            break_time = session.break_time or 0
        
        return {
            "inbound_calls": inbound_calls,
            "outbound_calls": outbound_calls,
            "abandoned_calls": abandoned_calls,
            "total_calls": total_calls,
            "break_time": format_time(break_time),
            "login_time": format_time(login_time),
            "session_id": session.session_id if session else None
        }
    except Exception as e:
        logger.error(f"Error fetching stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error fetching statistics")
