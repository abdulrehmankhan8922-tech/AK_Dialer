from pydantic import BaseModel
from typing import Optional


class LoginRequest(BaseModel):
    username: str
    password: str
    campaign: Optional[str] = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    agent_id: int
    username: str
    session_id: str
    campaign_id: Optional[int] = None
    campaign_code: Optional[str] = None
    is_admin: Optional[bool] = False


class TokenData(BaseModel):
    agent_id: int
    username: str
