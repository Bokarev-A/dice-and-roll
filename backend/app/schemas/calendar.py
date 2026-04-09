from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.session import SessionStatus
from app.models.signup import SignupStatus


class CalendarEntry(BaseModel):
    session_id: int
    campaign_id: int
    campaign_title: str
    campaign_type: str
    room_name: str
    starts_at: datetime
    ends_at: datetime
    session_status: SessionStatus
    signup_status: Optional[SignupStatus] = None
    is_gm: bool = False
    capacity: int
    confirmed_count: int
    description: Optional[str] = None


class PublicSessionEntry(BaseModel):
    session_id: int
    campaign_id: int
    campaign_title: str
    system: Optional[str] = None
    room_name: str
    starts_at: datetime
    ends_at: datetime
    capacity: int
    confirmed_count: int
    spots_left: int