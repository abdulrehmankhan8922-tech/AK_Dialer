from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.models.call import CallStatus, CallDirection


class CallBase(BaseModel):
    phone_number: str
    direction: CallDirection = CallDirection.OUTBOUND


class CallCreate(CallBase):
    campaign_id: Optional[int] = None
    contact_id: Optional[int] = None


class CallResponse(CallBase):
    id: int
    agent_id: Optional[int]
    campaign_id: Optional[int]
    contact_id: Optional[int]
    status: CallStatus
    start_time: datetime
    end_time: Optional[datetime] = None
    duration: int
    recording_path: Optional[str] = None
    call_unique_id: Optional[str] = None
    agent_channel: Optional[str] = None
    customer_channel: Optional[str] = None
    bridge_unique_id: Optional[str] = None
    is_muted: bool = False
    is_on_hold: bool = False
    billsec: int = 0
    disposition: Optional[str] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True
        use_enum_values = True


class CallUpdate(BaseModel):
    status: Optional[CallStatus] = None
    duration: Optional[int] = None
    notes: Optional[str] = None


class DialRequest(BaseModel):
    phone_number: str
    campaign_id: Optional[int] = None
    contact_id: Optional[int] = None


class CallControlRequest(BaseModel):
    call_id: int
    action: str  # hangup, transfer, park


class DispositionRequest(BaseModel):
    disposition: str
    notes: Optional[str] = None
