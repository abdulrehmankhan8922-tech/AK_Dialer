"""
Call Quality Metrics Model
Stores call quality metrics like jitter, packet loss, MOS score
"""
from sqlalchemy import Column, Integer, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class CallQualityMetrics(Base):
    __tablename__ = "call_quality_metrics"

    id = Column(Integer, primary_key=True, index=True)
    call_id = Column(Integer, ForeignKey("calls.id", ondelete="CASCADE"), nullable=False)
    jitter = Column(Float, nullable=True)  # Jitter in milliseconds
    packet_loss = Column(Float, nullable=True)  # Packet loss percentage
    mos_score = Column(Float, nullable=True)  # Mean Opinion Score (1-5)
    rtt = Column(Float, nullable=True)  # Round Trip Time in milliseconds
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    call = relationship("Call", back_populates="quality_metrics")
