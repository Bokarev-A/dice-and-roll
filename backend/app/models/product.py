from datetime import datetime

from sqlalchemy import String, Integer, Numeric, DateTime, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    credits: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_months: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )  # NULL = бессрочно
    category: Mapped[str] = mapped_column(
        String(50), nullable=False, default="player"
    )  # "player" | "gm_room"
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )