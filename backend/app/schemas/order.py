from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, model_validator, field_serializer

from app.models.order import OrderStatus


class OrderCreate(BaseModel):
    product_id: int


class OrderRead(BaseModel):
    id: int
    user_id: int
    product_id: int
    product_name: str = ""
    amount: float
    credits_count: int
    duration_months: Optional[int] = None
    status: OrderStatus
    payment_comment: str
    reject_reason: Optional[str] = None
    credits_granted: bool
    created_at: datetime
    paid_at: Optional[datetime] = None
    confirmed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

    @field_serializer('created_at', 'paid_at', 'confirmed_at')
    def serialize_dt(self, dt: Optional[datetime]) -> Optional[str]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

    @model_validator(mode="before")
    @classmethod
    def extract_product_name(cls, data):
        if hasattr(data, "product") and data.product:
            data.product_name = data.product.name
        return data


class OrderReject(BaseModel):
    reason: str


class QRPaymentInfo(BaseModel):
    order_id: int
    amount: float
    payment_comment: str
    qr_image_url: str
    qr_sbp_link: str
    recipient_name: str
    bank_name: str