from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.attendance import AttendanceStatus


class AttendanceUpdate(BaseModel):
    status: AttendanceStatus


class AttendanceRead(BaseModel):
    id: int
    session_id: int
    user_id: int
    user_name: str = ""
    status: AttendanceStatus
    unpaid: bool
    gm_credit_pending: bool = False
    marked_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UnpaidRead(BaseModel):
    attendance_id: int
    session_id: int
    user_id: int
    user_name: str
    session_date: datetime
    campaign_title: str