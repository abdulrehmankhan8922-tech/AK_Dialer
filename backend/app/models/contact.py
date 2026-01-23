from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base


class ContactStatus(str, enum.Enum):
    NEW = "new"
    CONTACTED = "contacted"
    NOT_ANSWERED = "not_answered"
    BUSY = "busy"
    FAILED = "failed"
    DO_NOT_CALL = "do_not_call"


class GenderType(str, enum.Enum):
    MALE = "M"
    FEMALE = "F"
    UNDEFINED = "U"


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False)
    name = Column(String, nullable=True)
    phone = Column(String, nullable=False, index=True)
    address = Column(String, nullable=True)
    city = Column(String, nullable=True)
    occupation = Column(String, nullable=True)
    gender = Column(String, default=GenderType.UNDEFINED.value)
    whatsapp = Column(String, nullable=True)
    email = Column(String, nullable=True)
    comments = Column(String, nullable=True)
    status = Column(String, default=ContactStatus.NEW.value)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    campaign = relationship("Campaign", back_populates="contacts")
    calls = relationship("Call", back_populates="contact")
