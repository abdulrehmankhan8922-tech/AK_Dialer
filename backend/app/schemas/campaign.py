from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from app.models.campaign import CampaignStatus, DialMethod


class CampaignBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None


class CampaignCreate(CampaignBase):
    status: CampaignStatus = CampaignStatus.ACTIVE
    dial_method: DialMethod = DialMethod.MANUAL


class CampaignResponse(CampaignBase):
    id: int
    status: CampaignStatus
    dial_method: DialMethod
    created_at: datetime

    class Config:
        from_attributes = True


class CampaignList(BaseModel):
    campaigns: List[CampaignResponse]
