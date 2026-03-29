from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ProductCreate(BaseModel):
    name: str
    price: float
    credits: int
    duration_months: Optional[int] = None


class ProductRead(BaseModel):
    id: int
    name: str
    price: float
    credits: int
    duration_months: Optional[int] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True