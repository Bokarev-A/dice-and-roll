import enum
from datetime import datetime

from sqlalchemy import (
    Integer, ForeignKey, DateTime, Enum as SAEnum,
    Boolean, func, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AttendanceStatus(str, enum.Enum):
    unmarked = "unmarked"
    attended = "attended"
    no_show = "no_show"
    excused = "excused"


class Attendance(Base):
    __tablename__ = "attendances"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("game_sessions.id"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    status: Mapped[AttendanceStatus] = mapped_column(
        SAEnum(AttendanceStatus),
        default=AttendanceStatus.unmarked,
        nullable=False,
    )
    unpaid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    gm_credit_pending: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    marked_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        UniqueConstraint(
            "session_id", "user_id", name="uq_attendance_session_user"
        ),
    )

    # Relationships
    session = relationship("GameSession", back_populates="attendances")
    user = relationship("User", foreign_keys=[user_id])
    marker = relationship("User", foreign_keys=[marked_by])