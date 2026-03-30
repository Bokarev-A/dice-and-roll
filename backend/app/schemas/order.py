from datetime import datetime
from typing import Optional

from pydantic import BaseModel, model_validator

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

    class Config:
        from_attributes = True

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