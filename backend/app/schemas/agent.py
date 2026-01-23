from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.models.agent import AgentStatus


class AgentBase(BaseModel):
    username: str
    phone_extension: str
    full_name: Optional[str] = None


class AgentCreate(AgentBase):
    password: str
    is_admin: int = 0


class AgentUpdate(BaseModel):
    username: Optional[str] = None
    phone_extension: Optional[str] = None
    full_name: Optional[str] = None
    password: Optional[str] = None
    is_admin: Optional[int] = None


class AgentResponse(AgentBase):
    id: int
    status: AgentStatus
    is_admin: int
    created_at: datetime

    class Config:
        from_attributes = True


class AgentSessionResponse(BaseModel):
    id: int
    agent_id: int
    campaign_id: Optional[int]
    session_id: str
    status: AgentStatus
    login_time: datetime
    break_time: int
    login_duration: int

    class Config:
        from_attributes = True


class AgentStatusUpdate(BaseModel):
    status: AgentStatus
