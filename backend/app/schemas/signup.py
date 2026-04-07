from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.signup import SignupStatus


class SignupCreate(BaseModel):
    session_id: int


class SignupRead(BaseModel):
    id: int
    session_id: int
    user_id: int
    user_name: Optional[str] = None
    status: SignupStatus
    waitlist_position: Optional[int] = None
    offered_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SignupAction(BaseModel):
    action: str  # "approve" or "reject"