from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.ledger import LedgerEntry
from app.schemas.credit import CreditBalanceRead, CreditBatchRead, LedgerEntryRead
from app.api.deps import get_current_user
from app.services.credit_service import get_available_batches, get_total_credits

router = APIRouter(prefix="/credits", tags=["credits"])


@router.get("/balance", response_model=CreditBalanceRead)
async def get_balance(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current user's credit balance with batch breakdown."""
    batches = await get_available_batches(db, current_user.id)
    total = sum(b.remaining for b in batches)

    return CreditBalanceRead(
        total_available=total,
        batches=[CreditBatchRead.model_validate(b) for b in batches],
    )


@router.get("/history", response_model=list[LedgerEntryRead])
async def get_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current user's credit transaction history."""
    result = await db.execute(
        select(LedgerEntry)
        .where(LedgerEntry.user_id == current_user.id)
        .order_by(LedgerEntry.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{user_id}/balance", response_model=CreditBalanceRead)
async def get_user_balance(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a user's credit balance. Admin or the user themselves."""
    from app.models.user import UserRole

    if current_user.id != user_id and current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    batches = await get_available_batches(db, user_id)
    total = sum(b.remaining for b in batches)

    return CreditBalanceRead(
        total_available=total,
        batches=[CreditBatchRead.model_validate(b) for b in batches],
    )