import enum
from datetime import datetime

from sqlalchemy import (
    Integer, ForeignKey, DateTime, Enum as SAEnum,
    func, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SignupStatus(str, enum.Enum):
    confirmed = "confirmed"
    waitlist = "waitlist"
    offered = "offered"
    cancelled = "cancelled"


class Signup(Base):
    __tablename__ = "signups"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("game_sessions.id"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    status: Mapped[SignupStatus] = mapped_column(
        SAEnum(SignupStatus), nullable=False
    )
    waitlist_position: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    offered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        UniqueConstraint(
            "session_id", "user_id", name="uq_signup_session_user"
        ),
    )

    # Relationships
    session = relationship("GameSession", back_populates="signups")
    user = relationship("User", back_populates="signups")