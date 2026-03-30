import enum
from datetime import datetime

from sqlalchemy import Integer, ForeignKey, DateTime, Enum as SAEnum, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CreditBatchStatus(str, enum.Enum):
    active = "active"
    exhausted = "exhausted"
    expired = "expired"



class CreditBatchType(str, enum.Enum):
    credit = "credit"
    rental = "rental"


class CreditBatch(Base):
    __tablename__ = "credit_batches"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    order_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("orders.id"), unique=True, nullable=False
    )
    batch_type: Mapped[str] = mapped_column(
        SAEnum(CreditBatchType), default=CreditBatchType.credit, nullable=False
    )
    total: Mapped[int] = mapped_column(Integer, nullable=False)
    remaining: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[CreditBatchStatus] = mapped_column(
        SAEnum(CreditBatchStatus), default=CreditBatchStatus.active, nullable=False
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    purchased_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    user = relationship("User", back_populates="credit_batches")
    order = relationship("Order", lazy="selectin")