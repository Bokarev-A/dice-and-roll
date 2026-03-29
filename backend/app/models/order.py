import enum
from datetime import datetime

from sqlalchemy import (
    Integer, ForeignKey, DateTime, Enum as SAEnum,
    String, Numeric, Boolean, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class OrderStatus(str, enum.Enum):
    pending = "pending"
    awaiting_confirmation = "awaiting_confirmation"
    confirmed = "confirmed"
    rejected = "rejected"
    expired = "expired"
    cancelled = "cancelled"


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    product_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("products.id"), nullable=False
    )
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    credits_count: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[OrderStatus] = mapped_column(
        SAEnum(OrderStatus), default=OrderStatus.pending, nullable=False
    )
    payment_comment: Mapped[str] = mapped_column(String(255), nullable=False)
    reject_reason: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    credits_granted: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user = relationship("User", back_populates="orders")
    product = relationship("Product", lazy="selectin")