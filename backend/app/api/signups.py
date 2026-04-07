from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.models.session import GameSession, SessionStatus
from app.models.signup import Signup, SignupStatus
from app.models.campaign import Campaign
from app.schemas.signup import SignupCreate, SignupRead, SignupAction
from app.api.deps import get_current_user, require_gm
from app.services.signup_service import (
    signup_for_session,
    cancel_signup,
    approve_offered,
    reject_offered,
)
from app.bot import notifications as notify

router = APIRouter(prefix="/signups", tags=["signups"])


# ── Player ───────────────────────────────────────────────────────


@router.post("/", response_model=SignupRead, status_code=status.HTTP_201_CREATED)
async def create_signup(
    body: SignupCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Sign up for a session."""
    session = await db.get(GameSession, body.session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    if session.status not in (SessionStatus.planned, SessionStatus.moved):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session is not open for signups",
        )

    try:
        signup = await signup_for_session(db, current_user.id, session)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return signup


@router.get("/my", response_model=list[SignupRead])
async def my_signups(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current user's active signups."""
    result = await db.execute(
        select(Signup)
        .where(
            and_(
                Signup.user_id == current_user.id,
                Signup.status != SignupStatus.cancelled,
            )
        )
        .order_by(Signup.created_at.desc())
    )
    return result.scalars().all()


@router.post("/{signup_id}/cancel", response_model=SignupRead)
async def cancel_my_signup(
    signup_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancel own signup."""
    signup = await db.get(Signup, signup_id)
    if not signup or signup.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Signup not found",
        )

    if signup.status == SignupStatus.cancelled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already cancelled",
        )

    signup = await cancel_signup(db, signup)

    # Notify GM about offered if waitlist was processed
    session = await db.get(GameSession, signup.session_id)
    if session:
        # Check if someone was offered
        result = await db.execute(
            select(Signup).where(
                and_(
                    Signup.session_id == session.id,
                    Signup.status == SignupStatus.offered,
                )
            )
        )
        offered = result.scalar_one_or_none()
        if offered:
            campaign = await db.get(Campaign, session.campaign_id)
            gm = await db.get(User, campaign.owner_gm_user_id) if campaign else None
            offered_user = await db.get(User, offered.user_id)
            if gm and offered_user and campaign:
                player_name = f"{offered_user.first_name} {offered_user.last_name or ''}".strip()
                await notify.notify_offered_place(
                    gm.telegram_id,
                    player_name,
                    campaign.title,
                    session.id,
                )

    return signup


# ── GM ───────────────────────────────────────────────────────────


@router.get("/session/{session_id}", response_model=list[SignupRead])
async def list_session_signups(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all signups for a session."""
    session = await db.get(GameSession, session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    result = await db.execute(
        select(Signup, User.first_name, User.last_name)
        .join(User, Signup.user_id == User.id)
        .where(Signup.session_id == session_id)
        .order_by(
            Signup.status.asc(),
            Signup.waitlist_position.asc().nulls_last(),
            Signup.created_at.asc(),
        )
    )
    rows = result.all()
    return [
        SignupRead(
            **{col.name: getattr(row.Signup, col.name) for col in Signup.__table__.columns},
            user_name=f"{row.first_name} {row.last_name or ''}".strip(),
        )
        for row in rows
    ]


@router.post("/{signup_id}/action", response_model=SignupRead)
async def handle_signup_action(
    signup_id: int,
    body: SignupAction,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_gm),
):
    """GM approves or rejects an offered signup."""
    signup = await db.get(Signup, signup_id)
    if not signup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Signup not found",
        )

    # Verify GM owns the campaign
    session = await db.get(GameSession, signup.session_id)
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

    try:
        if body.action == "approve":
            signup = await approve_offered(db, signup)

            # Notify player
            user = await db.get(User, signup.user_id)
            if user and campaign:
                import pytz
                from app.config import settings

                tz = pytz.timezone(settings.CLUB_TIMEZONE)
                starts_str = session.starts_at.astimezone(tz).strftime(
                    "%d.%m.%Y %H:%M"
                )
                await notify.notify_signup_confirmed(
                    user.telegram_id, campaign.title, starts_str
                )

        elif body.action == "reject":
            signup = await reject_offered(db, signup)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Action must be 'approve' or 'reject'",
            )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return signup


@router.delete("/{signup_id}", response_model=SignupRead)
async def gm_remove_signup(
    signup_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_gm),
):
    """GM removes a player from a session."""
    signup = await db.get(Signup, signup_id)
    if not signup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Signup not found",
        )

    session = await db.get(GameSession, signup.session_id)
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

    signup = await cancel_signup(db, signup)
    return signup