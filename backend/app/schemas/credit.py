from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel

from app.models.credit import CreditBatchStatus, CreditBatchType
from app.models.ledger import LedgerType


class CreditBatchRead(BaseModel):
    id: int
    order_id: int
    batch_type: CreditBatchType
    total: int
    remaining: int
    status: CreditBatchStatus
    expires_at: Optional[datetime] = None
    purchased_at: datetime

    class Config:
        from_attributes = True


class CreditBalanceRead(BaseModel):
    total_credits: int
    total_rentals: int
    credit_batches: List[CreditBatchRead]
    rental_batches: List[CreditBatchRead]


class LedgerEntryRead(BaseModel):
    id: int
    user_id: int
    credit_batch_id: int
    session_id: Optional[int] = None
    entry_type: LedgerType
    description: Optional[str] = None
    created_at: datetime
    created_by: Optional[int] = None

    class Config:
        from_attributes = True
