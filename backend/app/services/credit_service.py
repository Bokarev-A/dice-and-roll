from datetime import datetime, timezone, timedelta
from typing import Optional, List

from dateutil.relativedelta import relativedelta
from sqlalchemy import select, and_, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.credit import CreditBatch, CreditBatchStatus, CreditBatchType
from app.models.ledger import LedgerEntry, LedgerType
from app.models.order import Order
from app.models.product import Product


async def grant_credits(db: AsyncSession, order: Order) -> Optional[CreditBatch]:
    """
    Grant credits for a confirmed order.
    Idempotent — checks credits_granted flag.
    """
    if order.credits_granted:
        return None

    expires_at = None
    if order.duration_months:
        base_time = order.confirmed_at or datetime.now(timezone.utc)
        expires_at = base_time + relativedelta(months=order.duration_months)

    # Determine batch type from product category
    product = await db.get(Product, order.product_id)
    batch_type = CreditBatchType.rental if (product and product.category == "gm_room") else CreditBatchType.credit

    batch = CreditBatch(
        user_id=order.user_id,
        order_id=order.id,
        batch_type=batch_type,
        total=order.credits_count,
        remaining=order.credits_count,
        status=CreditBatchStatus.active,
        expires_at=expires_at,
    )
    db.add(batch)

    order.credits_granted = True

    await db.commit()
    await db.refresh(batch)
    return batch


async def grant_gm_reward(
    db: AsyncSession,
    gm_user_id: int,
    session_id: int,
) -> Optional[CreditBatch]:
    """
    Grant 1 GM reward credit for conducting a club session.
    Idempotent — checks if already granted for this session.
    """
    # Check if already granted
    existing = await db.execute(
        select(CreditBatch).where(
            and_(
                CreditBatch.user_id == gm_user_id,
                CreditBatch.session_id == session_id,
                CreditBatch.batch_type == CreditBatchType.gm_reward,
            )
        )
    )
    if existing.scalar_one_or_none():
        return None

    batch = CreditBatch(
        user_id=gm_user_id,
        session_id=session_id,
        order_id=None,
        batch_type=CreditBatchType.gm_reward,
        total=1,
        remaining=1,
        status=CreditBatchStatus.active,
        expires_at=None,  # GM rewards don't expire
    )
    db.add(batch)

    # Ledger entry
    await db.flush()
    entry = LedgerEntry(
        user_id=gm_user_id,
        credit_batch_id=batch.id,
        session_id=session_id,
        entry_type=LedgerType.gm_reward,
        description="Мастерский кредит за проведённую сессию",
    )
    db.add(entry)

    await db.commit()
    await db.refresh(batch)
    return batch


async def get_available_batches(
    db: AsyncSession, user_id: int
) -> List[CreditBatch]:
    """
    Get available credit batches for a user, ordered by FEFO.
    Filters out expired batches.
    """
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(CreditBatch)
        .where(
            and_(
                CreditBatch.user_id == user_id,
                CreditBatch.remaining > 0,
                CreditBatch.status == CreditBatchStatus.active,
            )
        )
        .order_by(
            CreditBatch.expires_at.is_(None).asc(),
            CreditBatch.expires_at.asc(),
            CreditBatch.purchased_at.asc(),
        )
    )
    batches = list(result.scalars().all())

    def is_valid(b: CreditBatch) -> bool:
        if b.expires_at is None:
            return True
        exp = b.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        return exp > now

    return [b for b in batches if is_valid(b)]


async def get_total_credits(db: AsyncSession, user_id: int) -> int:
    """Get total available credits for a user."""
    batches = await get_available_batches(db, user_id)
    return sum(b.remaining for b in batches)


async def count_gm_reward_debits_for_session(
    db: AsyncSession, session_id: int
) -> int:
    """
    Count how many gm_reward credits have been debited for this session.
    Used to enforce the 1-GM-reward-per-session limit.
    """
    result = await db.execute(
        select(sa_func.count(LedgerEntry.id))
        .select_from(LedgerEntry)
        .join(CreditBatch, LedgerEntry.credit_batch_id == CreditBatch.id)
        .where(
            and_(
                LedgerEntry.session_id == session_id,
                LedgerEntry.entry_type == LedgerType.debit,
                CreditBatch.batch_type == CreditBatchType.gm_reward,
            )
        )
    )
    return result.scalar() or 0


async def debit_credit(
    db: AsyncSession,
    user_id: int,
    session_id: int,
    marked_by: Optional[int] = None,
    prefer_gm_reward: bool = False,
) -> Optional[LedgerEntry]:
    """
    Debit 1 credit from user using FEFO.

    If prefer_gm_reward=True and user has gm_reward batches,
    tries to use gm_reward first — BUT only if no other gm_reward
    has been debited for this session yet (1 per session limit).

    Falls back to regular credits if gm_reward slot is taken.
    """
    batches = await get_available_batches(db, user_id)
    if not batches:
        return None

    gm_batches = [b for b in batches if b.batch_type == CreditBatchType.gm_reward]
    regular_batches = [b for b in batches if b.batch_type != CreditBatchType.gm_reward]

    batch = None

    if prefer_gm_reward and gm_batches:
        # Check if gm_reward slot is still free for this session
        gm_used = await count_gm_reward_debits_for_session(db, session_id)
        if gm_used == 0:
            batch = gm_batches[0]

    if batch is None:
        # Use regular credits (credit or rental type, FEFO order)
        if regular_batches:
            batch = regular_batches[0]
        elif gm_batches:
            # Only gm_reward left, check slot
            gm_used = await count_gm_reward_debits_for_session(db, session_id)
            if gm_used == 0:
                batch = gm_batches[0]

    if batch is None:
        return None

    batch.remaining -= 1
    if batch.remaining == 0:
        batch.status = CreditBatchStatus.exhausted

    entry = LedgerEntry(
        user_id=user_id,
        credit_batch_id=batch.id,
        session_id=session_id,
        entry_type=LedgerType.debit,
        description="Списание за посещение сессии",
        created_by=marked_by,
    )
    db.add(entry)

    await db.commit()
    await db.refresh(entry)
    return entry


async def refund_credit(
    db: AsyncSession,
    user_id: int,
    session_id: int,
    refunded_by: int,
) -> Optional[LedgerEntry]:
    """
    Refund 1 credit to the original batch that was debited for this session.
    """
    result = await db.execute(
        select(LedgerEntry).where(
            and_(
                LedgerEntry.user_id == user_id,
                LedgerEntry.session_id == session_id,
                LedgerEntry.entry_type == LedgerType.debit,
            )
        )
    )
    debit_entry = result.scalar_one_or_none()
    if not debit_entry:
        return None

    # Check if already refunded
    refund_check = await db.execute(
        select(LedgerEntry).where(
            and_(
                LedgerEntry.user_id == user_id,
                LedgerEntry.session_id == session_id,
                LedgerEntry.entry_type == LedgerType.refund,
            )
        )
    )
    if refund_check.scalar_one_or_none():
        return None

    # Restore to original batch if not expired
    result = await db.execute(
        select(CreditBatch).where(
            CreditBatch.id == debit_entry.credit_batch_id
        )
    )
    batch = result.scalar_one_or_none()
    if batch:
        now = datetime.now(timezone.utc)
        exp = batch.expires_at
        if exp is not None and exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp is None or exp > now:
            batch.remaining += 1
            if batch.status == CreditBatchStatus.exhausted:
                batch.status = CreditBatchStatus.active

    entry = LedgerEntry(
        user_id=user_id,
        credit_batch_id=debit_entry.credit_batch_id,
        session_id=session_id,
        entry_type=LedgerType.refund,
        description="Возврат кредита",
        created_by=refunded_by,
    )
    db.add(entry)

    await db.commit()
    await db.refresh(entry)
    return entry


async def expire_batches(db: AsyncSession) -> List[CreditBatch]:
    """Mark expired batches."""
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(CreditBatch).where(
            and_(
                CreditBatch.expires_at.isnot(None),
                CreditBatch.expires_at <= now,
                CreditBatch.status == CreditBatchStatus.active,
            )
        )
    )
    batches = list(result.scalars().all())

    for batch in batches:
        batch.status = CreditBatchStatus.expired

    if batches:
        await db.commit()

    return batches


async def get_expiring_batches(
    db: AsyncSession, days_ahead: int = 7
) -> List[CreditBatch]:
    """Get batches expiring within N days."""
    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(days=days_ahead)

    result = await db.execute(
        select(CreditBatch).where(
            and_(
                CreditBatch.expires_at.isnot(None),
                CreditBatch.expires_at > now,
                CreditBatch.expires_at <= cutoff,
                CreditBatch.status == CreditBatchStatus.active,
                CreditBatch.remaining > 0,
            )
        )
    )
    return list(result.scalars().all())
