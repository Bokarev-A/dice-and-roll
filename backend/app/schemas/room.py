from datetime import datetime

from pydantic import BaseModel


class RoomRead(BaseModel):
    id: int
    name: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True