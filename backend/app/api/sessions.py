from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.models.session import GameSession, SessionStatus
from app.models.campaign import Campaign
from app.models.room import Room
from app.models.signup import Signup, SignupStatus
from app.schemas.session import SessionCreate, SessionUpdate, SessionRead
from app.api.deps import get_current_user, require_gm
from app.services.signup_service import get_confirmed_count, get_waitlist_count, process_waitlist
from app.services.notification_service import (
    notify_session_participants,
    notify_campaign_members_new_session,
)

router = APIRouter(prefix="/sessions", tags=["sessions"])


async def check_room_conflict(
    db: AsyncSession,
    room_id: int,
    starts_at: datetime,
    ends_at: datetime,
    exclude_session_id: int | None = None,
):
    """Check if room has a time conflict with another session."""
    query = select(GameSession).where(
        and_(
            GameSession.room_id == room_id,
            GameSession.status.in_([
                SessionStatus.planned,
                SessionStatus.moved,
            ]),
            GameSession.starts_at < ends_at,
            GameSession.ends_at > starts_at,
        )
    )
    if exclude_session_id:
        query = query.where(GameSession.id != exclude_session_id)

    result = await db.execute(query)
    conflict = result.scalar_one_or_none()
    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Room conflict with session #{conflict.id}",
        )


async def session_to_read(
    db: AsyncSession, session: GameSession
) -> SessionRead:
    """Convert GameSession model to SessionRead schema."""
    confirmed = await get_confirmed_count(db, session.id)
    waitlist = await get_waitlist_count(db, session.id)

    room = await db.get(Room, session.room_id)
    campaign = await db.get(Campaign, session.campaign_id)

    return SessionRead(
        id=session.id,
        campaign_id=session.campaign_id,
        room_id=session.room_id,
        room_name=room.name if room else "",
        campaign_title=campaign.title if campaign else "",
        starts_at=session.starts_at,
        ends_at=session.ends_at,
        capacity=session.capacity,
        status=session.status,
        confirmed_count=confirmed,
        waitlist_count=waitlist,
        created_at=session.created_at,
    )


# ── Public ───────────────────────────────────────────────────────


@router.get("/campaign/{campaign_id}", response_model=list[SessionRead])
async def list_campaign_sessions(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all sessions for a campaign."""
    campaign = await db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found",
        )

    result = await db.execute(
        select(GameSession)
        .where(GameSession.campaign_id == campaign_id)
        .order_by(GameSession.starts_at.asc())
    )
    sessions = result.scalars().all()
    return [await session_to_read(db, s) for s in sessions]


@router.get("/{session_id}", response_model=SessionRead)
async def get_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get session by ID."""
    session = await db.get(GameSession, session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    return await session_to_read(db, session)


# ── GM ───────────────────────────────────────────────────────────


@router.post("/", response_model=SessionRead, status_code=status.HTTP_201_CREATED)
async def create_session(
    body: SessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_gm),
):
    """Create a new session. GM only."""
    # Verify campaign ownership
    campaign = await db.get(Campaign, body.campaign_id)
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

    # Verify room exists
    room = await db.get(Room, body.room_id)
    if not room or not room.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found",
        )

    # Validate times
    if body.starts_at >= body.ends_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="starts_at must be before ends_at",
        )

    if body.capacity < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="capacity must be at least 1",
        )

    # Check room conflict
    await check_room_conflict(db, body.room_id, body.starts_at, body.ends_at)

    session = GameSession(
        campaign_id=body.campaign_id,
        room_id=body.room_id,
        starts_at=body.starts_at,
        ends_at=body.ends_at,
        capacity=body.capacity,
        status=SessionStatus.planned,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    # Notify campaign members
    await notify_campaign_members_new_session(db, session)

    return await session_to_read(db, session)


@router.patch("/{session_id}", response_model=SessionRead)
async def update_session(
    session_id: int,
    body: SessionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_gm),
):
    """Update a session. GM only."""
    session = await db.get(GameSession, session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    campaign = await db.get(Campaign, session.campaign_id)
    if (
        campaign.owner_gm_user_id != current_user.id
        and current_user.role != UserRole.admin
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not your campaign",
        )

    # Track changes for notifications
    old_starts_at = session.starts_at
    old_status = session.status
    time_changed = False
    capacity_increased = False

    update_data = body.model_dump(exclude_unset=True)

    # Validate new times
    new_starts = update_data.get("starts_at", session.starts_at)
    new_ends = update_data.get("ends_at", session.ends_at)
    new_room = update_data.get("room_id", session.room_id)

    if "starts_at" in update_data or "ends_at" in update_data:
        if new_starts >= new_ends:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="starts_at must be before ends_at",
            )
        time_changed = True

    if "room_id" in update_data:
        room = await db.get(Room, new_room)
        if not room or not room.is_active:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Room not found",
            )
        time_changed = True

    # Check room conflict for time/room changes
    if time_changed or "room_id" in update_data:
        await check_room_conflict(
            db, new_room, new_starts, new_ends,
            exclude_session_id=session_id,
        )

    # Check capacity increase
    if "capacity" in update_data:
        if update_data["capacity"] < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="capacity must be at least 1",
            )
        if update_data["capacity"] > session.capacity:
            capacity_increased = True

    # Apply updates
    for field, value in update_data.items():
        setattr(session, field, value)

    # Update status to moved if time/room changed
    if time_changed and session.status == SessionStatus.planned:
        session.status = SessionStatus.moved

    await db.commit()
    await db.refresh(session)

    # Notifications
    new_status = session.status
    if new_status == SessionStatus.canceled and old_status != SessionStatus.canceled:
        await notify_session_participants(db, session, "canceled")
    elif time_changed:
        await notify_session_participants(
            db, session, "moved", old_starts_at=old_starts_at
        )

    # Process waitlist if capacity increased
    if capacity_increased:
        confirmed = await get_confirmed_count(db, session.id)
        while confirmed < session.capacity:
            offered = await process_waitlist(db, session.id)
            if not offered:
                break
            confirmed += 1

    return await session_to_read(db, session)


@router.get("/gm/my", response_model=list[SessionRead])
async def my_gm_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_gm),
):
    """List sessions for campaigns owned by current GM."""
    result = await db.execute(
        select(GameSession)
        .join(Campaign, GameSession.campaign_id == Campaign.id)
        .where(Campaign.owner_gm_user_id == current_user.id)
        .order_by(GameSession.starts_at.desc())
    )
    sessions = result.scalars().all()
    return [await session_to_read(db, s) for s in sessions]