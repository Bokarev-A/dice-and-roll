from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.models.session import GameSession
from app.models.campaign import Campaign, CampaignFunding
from app.models.attendance import Attendance
from app.schemas.attendance import AttendanceUpdate, AttendanceRead, UnpaidRead
from app.api.deps import get_current_user, require_gm, require_admin
from app.services.attendance_service import (
    create_attendances_for_session,
    mark_attendance,
    get_session_attendances,
    get_unpaid_attendances,
    complete_session_if_all_marked,
)
from app.services.credit_service import refund_credit, grant_gm_reward
from app.bot import notifications as notify
from app.config import settings

router = APIRouter(prefix="/attendance", tags=["attendance"])


async def check_gm_session_access(
    db: AsyncSession, session_id: int, current_user: User
) -> GameSession:
    """Verify GM has access to the session."""
    session = await db.get(GameSession, session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    campaign = await db.get(Campaign, session.campaign_id)
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found",
        )

    if (
        campaign.owner_gm_user_id != current_user.id
        and current_user.role != UserRole.admin
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not your campaign",
        )

    return session


def attendance_to_read(attendance: Attendance, user: User | None = None) -> AttendanceRead:
    """Convert Attendance model to AttendanceRead schema."""
    user_name = ""
    if user:
        user_name = f"{user.first_name} {user.last_name or ''}".strip()

    return AttendanceRead(
        id=attendance.id,
        session_id=attendance.session_id,
        user_id=attendance.user_id,
        user_name=user_name,
        status=attendance.status,
        unpaid=attendance.unpaid,
        marked_by=attendance.marked_by,
        created_at=attendance.created_at,
        updated_at=attendance.updated_at,
    )


# ── GM endpoints ─────────────────────────────────────────────────


@router.post("/session/{session_id}/init")
async def init_attendance(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_gm),
):
    """
    Initialize attendance records for a session.
    Creates unmarked records for all confirmed signups.
    """
    session = await check_gm_session_access(db, session_id, current_user)

    now = datetime.now(timezone.utc)
    if now < session.starts_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot mark attendance before session starts",
        )

    await create_attendances_for_session(db, session_id)
    return {"detail": "Attendance initialized"}


@router.get("/session/{session_id}", response_model=list[AttendanceRead])
async def list_attendance(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_gm),
):
    """List attendance for a session."""
    session = await check_gm_session_access(db, session_id, current_user)

    attendances = await get_session_attendances(db, session_id)
    result = []
    for att in attendances:
        user = await db.get(User, att.user_id)
        result.append(attendance_to_read(att, user))

    return result


@router.patch(
    "/session/{session_id}/user/{user_id}",
    response_model=AttendanceRead,
)
async def update_attendance(
    session_id: int,
    user_id: int,
    body: AttendanceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_gm),
):
    """Mark attendance for a specific user at a session."""
    session = await check_gm_session_access(db, session_id, current_user)

    # Check attendance window for non-admins
    now = datetime.now(timezone.utc)
    if now < session.starts_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot mark attendance before session starts",
        )

    from datetime import timedelta

    window_end = session.ends_at + timedelta(
        hours=settings.ATTENDANCE_WINDOW_HOURS
    )
    if now > window_end and current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attendance window has closed. Contact admin.",
        )

    attendance = await mark_attendance(
        db, session_id, user_id, body.status, current_user.id
    )

    campaign = await db.get(Campaign, session.campaign_id)

    # Grant GM reward for club-funded campaigns (idempotent — fires once per session)
    if campaign and campaign.funding == CampaignFunding.club:
        await grant_gm_reward(db, campaign.owner_gm_user_id, session_id)

    # Auto-complete session if all attendances are marked
    await complete_session_if_all_marked(db, session_id)

    # Notify if unpaid
    if attendance.unpaid:
        user = await db.get(User, user_id)
        if user and campaign:
            import pytz

            tz = pytz.timezone(settings.CLUB_TIMEZONE)
            session_date = session.starts_at.astimezone(tz).strftime(
                "%d.%m.%Y"
            )
            await notify.notify_unpaid(
                user.telegram_id, campaign.title, session_date
            )

    user = await db.get(User, user_id)
    return attendance_to_read(attendance, user)


# ── Refund ───────────────────────────────────────────────────────


@router.post(
    "/session/{session_id}/user/{user_id}/refund",
    response_model=AttendanceRead,
)
async def refund_attendance(
    session_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_gm),
):
    """Refund a credit for a user's attendance at a session."""
    session = await check_gm_session_access(db, session_id, current_user)

    entry = await refund_credit(db, user_id, session_id, current_user.id)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No debit found to refund or already refunded",
        )

    # Update unpaid flag
    from sqlalchemy import and_

    result = await db.execute(
        select(Attendance).where(
            and_(
                Attendance.session_id == session_id,
                Attendance.user_id == user_id,
            )
        )
    )
    attendance = result.scalar_one_or_none()
    if attendance:
        attendance.unpaid = False
        await db.commit()
        await db.refresh(attendance)

    user = await db.get(User, user_id)
    return attendance_to_read(attendance, user)


# ── Unpaid reports ───────────────────────────────────────────────


@router.get("/unpaid", response_model=list[UnpaidRead])
async def list_unpaid(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_gm),
):
    """
    List unpaid attendances.
    GM sees only their sessions. Admin sees all.
    """
    gm_id = None
    if current_user.role != UserRole.admin:
        gm_id = current_user.id

    attendances = await get_unpaid_attendances(db, gm_id)

    result = []
    for att in attendances:
        user = await db.get(User, att.user_id)
        session = await db.get(GameSession, att.session_id)
        campaign = await db.get(Campaign, session.campaign_id) if session else None

        result.append(
            UnpaidRead(
                attendance_id=att.id,
                session_id=att.session_id,
                user_id=att.user_id,
                user_name=f"{user.first_name} {user.last_name or ''}".strip() if user else "",
                session_date=session.starts_at if session else datetime.now(timezone.utc),
                campaign_title=campaign.title if campaign else "",
            )
        )

    return result