import enum
from datetime import datetime

from sqlalchemy import (
    Integer, ForeignKey, DateTime, Enum as SAEnum, String, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class LedgerType(str, enum.Enum):
    debit = "debit"          # Списание кредита за посещение
    refund = "refund"        # Возврат кредита
    gm_reward = "gm_reward"  # Начисление мастерского кредита


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    credit_batch_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("credit_batches.id"), nullable=False
    )
    session_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("game_sessions.id"), nullable=True
    )
    entry_type: Mapped[LedgerType] = mapped_column(
        SAEnum(LedgerType), nullable=False
    )
    description: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    created_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    credit_batch = relationship("CreditBatch")
    session = relationship("GameSession")
    creator = relationship("User", foreign_keys=[created_by])
