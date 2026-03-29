import enum
from datetime import datetime

from sqlalchemy import BigInteger, String, DateTime, Enum as SAEnum, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, enum.Enum):
    player = "player"
    gm = "gm"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    telegram_id: Mapped[int] = mapped_column(
        BigInteger, unique=True, nullable=False, index=True
    )
    first_name: Mapped[str] = mapped_column(String(255), nullable=False)
    last_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole), default=UserRole.player, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    orders = relationship("Order", back_populates="user")
    credit_batches = relationship("CreditBatch", back_populates="user")
    owned_campaigns = relationship("Campaign", back_populates="owner")
    memberships = relationship("CampaignMember", back_populates="user")
    signups = relationship("Signup", back_populates="user")