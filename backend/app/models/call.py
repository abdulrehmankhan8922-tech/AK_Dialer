from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base


class CallStatus(str, enum.Enum):
    DIALING = "dialing"
    RINGING = "ringing"
    CONNECTED = "connected"
    ANSWERED = "answered"
    ENDED = "ended"
    FAILED = "failed"
    BUSY = "busy"
    NO_ANSWER = "no_answer"
    PARKED = "parked"
    TRANSFERRED = "transferred"


class CallDirection(str, enum.Enum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"


class Call(Base):
    __tablename__ = "calls"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=True)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)
    phone_number = Column(String, nullable=False, index=True)
    direction = Column(String, default=CallDirection.OUTBOUND.value)
    status = Column(String, default=CallStatus.DIALING.value)
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True), nullable=True)
    duration = Column(Integer, default=0)  # seconds
    recording_path = Column(String, nullable=True)
    call_unique_id = Column(String, unique=True, index=True, nullable=True)  # Unique call ID
    freeswitch_channel = Column(String, nullable=True)  # Legacy field name, now stores primary channel
    agent_channel = Column(String, nullable=True)  # Agent's Asterisk channel
    customer_channel = Column(String, nullable=True)  # Customer's Asterisk channel
    bridge_unique_id = Column(String, nullable=True)  # Bridge unique ID when call is bridged
    is_muted = Column(Boolean, default=False)  # Mute state
    is_on_hold = Column(Boolean, default=False)  # Hold state
    billsec = Column(Integer, default=0)  # Billed seconds from CDR
    disposition = Column(String, nullable=True)  # Call disposition (SALE, NA, BUSY, etc.)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    agent = relationship("Agent", back_populates="calls")
    campaign = relationship("Campaign", back_populates="calls")
    contact = relationship("Contact", back_populates="calls")
    recordings = relationship("CallRecording", back_populates="call", cascade="all, delete-orphan")
    quality_metrics = relationship("CallQualityMetrics", back_populates="call", cascade="all, delete-orphan", uselist=False)
