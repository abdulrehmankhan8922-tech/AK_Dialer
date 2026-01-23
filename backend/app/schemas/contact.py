from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.models.contact import ContactStatus, GenderType


class ContactBase(BaseModel):
    name: Optional[str] = None
    phone: str
    address: Optional[str] = None
    city: Optional[str] = None
    occupation: Optional[str] = None
    gender: GenderType = GenderType.UNDEFINED
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    comments: Optional[str] = None


class ContactCreate(ContactBase):
    campaign_id: int


class ContactUpdate(ContactBase):
    status: Optional[ContactStatus] = None


class ContactResponse(ContactBase):
    id: int
    campaign_id: int
    status: ContactStatus
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
