from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base


class CampaignStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    PAUSED = "paused"


class DialMethod(str, enum.Enum):
    MANUAL = "manual"
    PROGRESSIVE = "progressive"
    PREDICTIVE = "predictive"


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    code = Column(String, unique=True, index=True, nullable=False)  # e.g., "J7GC4"
    description = Column(String, nullable=True)
    status = Column(String, default=CampaignStatus.ACTIVE.value)
    dial_method = Column(String, default=DialMethod.MANUAL.value)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    contacts = relationship("Contact", back_populates="campaign")
    calls = relationship("Call", back_populates="campaign")
    sessions = relationship("AgentSession", back_populates="campaign")
