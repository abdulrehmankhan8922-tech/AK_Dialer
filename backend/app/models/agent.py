from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base


class AgentStatus(str, enum.Enum):
    AVAILABLE = "available"
    PAUSED = "paused"
    IN_CALL = "in_call"
    ON_BREAK = "on_break"
    LOGGED_OUT = "logged_out"


class Agent(Base):
    __tablename__ = "agents"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    phone_extension = Column(String, unique=True, index=True, nullable=False)
    status = Column(String, default=AgentStatus.LOGGED_OUT.value)
    is_admin = Column(Integer, default=0)  # 0 = agent, 1 = admin
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    sessions = relationship("AgentSession", back_populates="agent")
    calls = relationship("Call", back_populates="agent")


class AgentSession(Base):
    __tablename__ = "agent_sessions"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=True)
    session_id = Column(String, unique=True, index=True, nullable=False)
    status = Column(String, default=AgentStatus.AVAILABLE.value)
    login_time = Column(DateTime(timezone=True), server_default=func.now())
    logout_time = Column(DateTime(timezone=True), nullable=True)
    break_time = Column(Integer, default=0)  # seconds
    login_duration = Column(Integer, default=0)  # seconds
    
    # Relationships
    agent = relationship("Agent", back_populates="sessions")
    campaign = relationship("Campaign", back_populates="sessions")
