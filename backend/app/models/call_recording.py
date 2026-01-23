"""
Call Recording Model
Stores information about call recordings
"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class CallRecording(Base):
    __tablename__ = "call_recordings"

    id = Column(Integer, primary_key=True, index=True)
    call_id = Column(Integer, ForeignKey("calls.id", ondelete="CASCADE"), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=True)  # Size in bytes
    duration = Column(Integer, nullable=True)  # Duration in seconds
    format = Column(String(20), default="wav")  # Audio format (wav, mp3, etc.)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    call = relationship("Call", back_populates="recordings")
