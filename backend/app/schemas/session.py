from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.session import SessionStatus


class SessionCreate(BaseModel):
    campaign_id: int
    room_id: int
    starts_at: datetime
    ends_at: datetime
    capacity: int


class SessionUpdate(BaseModel):
    room_id: Optional[int] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    capacity: Optional[int] = None
    status: Optional[SessionStatus] = None


class SessionRead(BaseModel):
    id: int
    campaign_id: int
    room_id: int
    room_name: str = ""
    campaign_title: str = ""
    starts_at: datetime
    ends_at: datetime
    capacity: int
    status: SessionStatus
    confirmed_count: int = 0
    waitlist_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True