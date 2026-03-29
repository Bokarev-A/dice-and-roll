from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select, and_, func, literal, union_all
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.models.session import GameSession, SessionStatus
from app.models.signup import Signup, SignupStatus
from app.models.campaign import Campaign, CampaignVisibility, CampaignType
from app.models.room import Room
from app.schemas.calendar import CalendarEntry, PublicSessionEntry
from app.api.deps import get_current_user

router = APIRouter(prefix="/calendar", tags=["calendar"])


async def _build_entry(
    db: AsyncSession,
    session: GameSession,
    signup_status: str | None,
    is_gm: bool,
) -> CalendarEntry:
    """Build a CalendarEntry from a session."""
    campaign = await db.get(Campaign, session.campaign_id)
    room = await db.get(Room, session.room_id)

    confirmed_result = await db.execute(
        select(func.count())
        .select_from(Signup)
        .where(
            and_(
                Signup.session_id == session.id,
                Signup.status == SignupStatus.confirmed,
            )
        )
    )
    confirmed_count = confirmed_result.scalar() or 0

    return CalendarEntry(
        session_id=session.id,
        campaign_id=session.campaign_id,
        campaign_title=campaign.title if campaign else "",
        campaign_type=campaign.type.value if campaign else "",
        room_name=room.name if room else "",
        starts_at=session.starts_at,
        ends_at=session.ends_at,
        session_status=session.status,
        signup_status=signup_status,
        is_gm=is_gm,
        capacity=session.capacity,
        confirmed_count=confirmed_count,
    )


@router.get("/my", response_model=list[CalendarEntry])
async def my_calendar(
    status_filter: SignupStatus | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get current user's upcoming sessions.
    Includes both player signups AND GM-owned sessions.
    """
    now = datetime.now(timezone.utc)

    active_statuses = [SessionStatus.planned, SessionStatus.moved]
    entries: list[CalendarEntry] = []
    seen_session_ids: set[int] = set()

    # 1) GM sessions — sessions from campaigns owned by this user
    if current_user.role in (UserRole.gm, UserRole.admin):
        gm_result = await db.execute(
            select(GameSession)
            .join(Campaign, GameSession.campaign_id == Campaign.id)
            .where(
                and_(
                    Campaign.owner_gm_user_id == current_user.id,
                    GameSession.starts_at >= now,
                    GameSession.status.in_(active_statuses),
                )
            )
            .order_by(GameSession.starts_at.asc())
        )
        for session in gm_result.scalars().all():
            seen_session_ids.add(session.id)
            entries.append(
                await _build_entry(db, session, signup_status=None, is_gm=True)
            )

    # 2) Player signups
    signup_query = (
        select(GameSession, Signup)
        .join(Signup, Signup.session_id == GameSession.id)
        .where(
            and_(
                Signup.user_id == current_user.id,
                Signup.status != SignupStatus.cancelled,
                GameSession.starts_at >= now,
                GameSession.status.in_(active_statuses),
            )
        )
    )

    if status_filter:
        signup_query = signup_query.where(Signup.status == status_filter)

    signup_query = signup_query.order_by(GameSession.starts_at.asc())

    result = await db.execute(signup_query)
    for session, signup in result.all():
        if session.id not in seen_session_ids:
            seen_session_ids.add(session.id)
            entries.append(
                await _build_entry(
                    db, session, signup_status=signup.status, is_gm=False
                )
            )

    # Sort all by starts_at
    entries.sort(key=lambda e: e.starts_at)

    return entries


@router.get("/public", response_model=list[PublicSessionEntry])
async def public_sessions(
    db: AsyncSession = Depends(get_db),
):
    """
    Public catalog: upcoming oneshot sessions with open spots.
    No auth required.
    """
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(GameSession)
        .join(Campaign, GameSession.campaign_id == Campaign.id)
        .where(
            and_(
                Campaign.type == CampaignType.oneshot,
                Campaign.visibility == CampaignVisibility.public,
                Campaign.status == "active",
                GameSession.starts_at >= now,
                GameSession.status.in_([
                    SessionStatus.planned,
                    SessionStatus.moved,
                ]),
            )
        )
        .order_by(GameSession.starts_at.asc())
    )
    sessions = result.scalars().all()

    entries = []
    for session in sessions:
        campaign = await db.get(Campaign, session.campaign_id)
        room = await db.get(Room, session.room_id)

        confirmed_result = await db.execute(
            select(func.count())
            .select_from(Signup)
            .where(
                and_(
                    Signup.session_id == session.id,
                    Signup.status == SignupStatus.confirmed,
                )
            )
        )
        confirmed_count = confirmed_result.scalar() or 0
        spots_left = max(0, session.capacity - confirmed_count)

        if spots_left > 0:
            entries.append(
                PublicSessionEntry(
                    session_id=session.id,
                    campaign_id=session.campaign_id,
                    campaign_title=campaign.title if campaign else "",
                    system=campaign.system if campaign else None,
                    room_name=room.name if room else "",
                    starts_at=session.starts_at,
                    ends_at=session.ends_at,
                    capacity=session.capacity,
                    confirmed_count=confirmed_count,
                    spots_left=spots_left,
                )
            )

    return entries