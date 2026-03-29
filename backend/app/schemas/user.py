from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.user import UserRole


class UserRead(BaseModel):
    id: int
    telegram_id: int
    first_name: str
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None
    role: UserRole
    created_at: datetime

    class Config:
        from_attributes = True


class UserRoleUpdate(BaseModel):
    role: UserRole