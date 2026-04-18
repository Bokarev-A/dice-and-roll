from datetime import datetime, timezone, timedelta

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attendance import Attendance, AttendanceStatus
from app.models.signup import Signup, SignupStatus
from app.models.session import GameSession, SessionStatus
from app.services.credit_service import debit_credit, debit_credit_as_debt, has_gm_reward_credits


async def create_attendances_for_session(
    db: AsyncSession, session_id: int
):
    """
    Create attendance records for all confirmed signups of a session.
    Called when GM starts marking attendance.
    """
    result = await db.execute(
        select(Signup).where(
            and_(
                Signup.session_id == session_id,
                Signup.status == SignupStatus.confirmed,
            )
        )
    )
    signups = result.scalars().all()

    for signup in signups:
        # Check if attendance already exists
        existing = await db.execute(
            select(Attendance).where(
                and_(
                    Attendance.session_id == session_id,
                    Attendance.user_id == signup.user_id,
                )
            )
        )
        if not existing.scalar_one_or_none():
            attendance = Attendance(
                session_id=session_id,
                user_id=signup.user_id,
                status=AttendanceStatus.unmarked,
            )
            db.add(attendance)

    await db.commit()


async def mark_attendance(
    db: AsyncSession,
    session_id: int,
    user_id: int,
    status: AttendanceStatus,
    marked_by: int,
    skip_debit: bool = False,
) -> Attendance:
    """
    Mark attendance for a user at a session.
    If attended and not skip_debit: attempt to debit credit. If no credit: unpaid=True.
    skip_debit=True is used for private-funded campaigns where players don't pay credits.
    """
    # Get or create attendance record
    result = await db.execute(
        select(Attendance).where(
            and_(
                Attendance.session_id == session_id,
                Attendance.user_id == user_id,
            )
        )
    )
    attendance = result.scalar_one_or_none()

    if not attendance:
        attendance = Attendance(
            session_id=session_id,
            user_id=user_id,
            status=status,
            marked_by=marked_by,
        )
        db.add(attendance)
    else:
        attendance.status = status
        attendance.marked_by = marked_by
        attendance.unpaid = False
        attendance.gm_credit_pending = False

    await db.flush()

    # Handle credit debit for attended (skipped for private-funded campaigns)
    if status == AttendanceStatus.attended and not skip_debit:
        if await has_gm_reward_credits(db, user_id):
            attendance.gm_credit_pending = True
        else:
            ledger_entry = await debit_credit(db, user_id, session_id, marked_by)
            if ledger_entry is None:
                await debit_credit_as_debt(db, user_id, session_id, marked_by)
                attendance.unpaid = True

    await db.commit()
    await db.refresh(attendance)
    return attendance


async def complete_session_if_all_marked(
    db: AsyncSession, session_id: int
) -> bool:
    """
    Set session status to 'done' if all attendance records are marked.
    Returns True if session was completed.
    """
    result = await db.execute(
        select(Attendance).where(
            and_(
                Attendance.session_id == session_id,
                Attendance.status == AttendanceStatus.unmarked,
            )
        )
    )
    has_unmarked = result.scalar_one_or_none() is not None
    if has_unmarked:
        return False

    session = await db.get(GameSession, session_id)
    if session and session.status not in (SessionStatus.done, SessionStatus.canceled):
        session.status = SessionStatus.done
        await db.commit()
        return True

    return False


async def get_session_attendances(
    db: AsyncSession, session_id: int
) -> list[Attendance]:
    """Get all attendance records for a session."""
    result = await db.execute(
        select(Attendance).where(
            Attendance.session_id == session_id
        )
    )
    return list(result.scalars().all())


async def get_unpaid_attendances(
    db: AsyncSession, gm_user_id: int | None = None
) -> list[Attendance]:
    """
    Get unpaid attendances.
    If gm_user_id is provided, filter by GM's sessions only.
    """
    from app.models.campaign import Campaign

    query = (
        select(Attendance)
        .join(GameSession, Attendance.session_id == GameSession.id)
        .where(Attendance.unpaid == True)  # noqa: E712
    )

    if gm_user_id:
        query = query.join(
            Campaign, GameSession.campaign_id == Campaign.id
        ).where(Campaign.owner_gm_user_id == gm_user_id)

    result = await db.execute(query)
    return list(result.scalars().all())


async def get_unmarked_sessions(
    db: AsyncSession, hours_threshold: int = 48
) -> list[GameSession]:
    """
    Get sessions that ended more than N hours ago
    but still have unmarked attendance.
    Used by scheduler for GM reminders.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours_threshold)

    result = await db.execute(
        select(GameSession)
        .join(Attendance, GameSession.id == Attendance.session_id)
        .where(
            and_(
                GameSession.ends_at <= cutoff,
                Attendance.status == AttendanceStatus.unmarked,
            )
        )
        .distinct()
    )
    return list(result.scalars().all())