from datetime import datetime, timezone

from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.signup import Signup, SignupStatus
from app.models.session import GameSession
from app.models.campaign import Campaign, CampaignMember, CampaignType


async def check_campaign_access(
    db: AsyncSession, user_id: int, session: GameSession
) -> bool:
    """
    Check if user can sign up for this session.
    Oneshots: anyone can join.
    Campaigns: only members.
    """
    campaign = await db.get(Campaign, session.campaign_id)
    if not campaign:
        return False

    if campaign.type == CampaignType.oneshot:
        return True

    result = await db.execute(
        select(CampaignMember).where(
            and_(
                CampaignMember.campaign_id == session.campaign_id,
                CampaignMember.user_id == user_id,
            )
        )
    )
    return result.scalar_one_or_none() is not None


async def auto_join_oneshot(
    db: AsyncSession, user_id: int, campaign_id: int
):
    """Auto-join user to oneshot campaign if not already a member."""
    result = await db.execute(
        select(CampaignMember).where(
            and_(
                CampaignMember.campaign_id == campaign_id,
                CampaignMember.user_id == user_id,
            )
        )
    )
    if not result.scalar_one_or_none():
        member = CampaignMember(
            campaign_id=campaign_id,
            user_id=user_id,
        )
        db.add(member)


async def get_confirmed_count(
    db: AsyncSession, session_id: int
) -> int:
    """Get count of confirmed signups for a session."""
    result = await db.execute(
        select(func.count())
        .select_from(Signup)
        .where(
            and_(
                Signup.session_id == session_id,
                Signup.status == SignupStatus.confirmed,
            )
        )
    )
    return result.scalar() or 0


async def get_waitlist_count(
    db: AsyncSession, session_id: int
) -> int:
    """Get count of waitlisted signups for a session."""
    result = await db.execute(
        select(func.count())
        .select_from(Signup)
        .where(
            and_(
                Signup.session_id == session_id,
                Signup.status == SignupStatus.waitlist,
            )
        )
    )
    return result.scalar() or 0


async def signup_for_session(
    db: AsyncSession, user_id: int, session: GameSession
) -> Signup:
    """
    Sign up a user for a session.
    If capacity allows: confirmed. Otherwise: waitlist.
    """
    # Check if already signed up (non-cancelled)
    result = await db.execute(
        select(Signup).where(
            and_(
                Signup.session_id == session.id,
                Signup.user_id == user_id,
                Signup.status != SignupStatus.cancelled,
            )
        )
    )
    if result.scalar_one_or_none():
        raise ValueError("Вы уже записаны на эту сессию")

    # Check access
    has_access = await check_campaign_access(db, user_id, session)
    if not has_access:
        raise ValueError("Вы не участник этой кампании")

    # Auto-join oneshot
    campaign = await db.get(Campaign, session.campaign_id)
    if campaign and campaign.type == CampaignType.oneshot:
        await auto_join_oneshot(db, user_id, session.campaign_id)

    # Determine status
    confirmed_count = await get_confirmed_count(db, session.id)

    if confirmed_count < session.capacity:
        status = SignupStatus.confirmed
        position = None
    else:
        status = SignupStatus.waitlist
        max_pos_result = await db.execute(
            select(func.max(Signup.waitlist_position)).where(
                and_(
                    Signup.session_id == session.id,
                    Signup.status == SignupStatus.waitlist,
                )
            )
        )
        max_pos = max_pos_result.scalar() or 0
        position = max_pos + 1

    signup = Signup(
        session_id=session.id,
        user_id=user_id,
        status=status,
        waitlist_position=position,
    )
    db.add(signup)

    await db.commit()
    await db.refresh(signup)
    return signup


async def cancel_signup(db: AsyncSession, signup: Signup) -> Signup:
    """Cancel a signup. If was confirmed, process waitlist."""
    was_confirmed = signup.status == SignupStatus.confirmed

    signup.status = SignupStatus.cancelled
    signup.waitlist_position = None

    await db.commit()

    if was_confirmed:
        await process_waitlist(db, signup.session_id)

    await db.refresh(signup)
    return signup


async def process_waitlist(
    db: AsyncSession, session_id: int
) -> Signup | None:
    """
    Move first waitlisted player to offered status.
    Returns the offered signup or None.
    """
    session = await db.get(GameSession, session_id)
    if not session:
        return None

    confirmed_count = await get_confirmed_count(db, session_id)
    if confirmed_count >= session.capacity:
        return None

    # Get first in waitlist
    result = await db.execute(
        select(Signup)
        .where(
            and_(
                Signup.session_id == session_id,
                Signup.status == SignupStatus.waitlist,
            )
        )
        .order_by(Signup.waitlist_position.asc())
        .limit(1)
    )
    first_waitlist = result.scalar_one_or_none()
    if not first_waitlist:
        return None

    first_waitlist.status = SignupStatus.offered
    first_waitlist.offered_at = datetime.now(timezone.utc)
    first_waitlist.waitlist_position = None

    await db.commit()
    await db.refresh(first_waitlist)
    return first_waitlist


async def approve_offered(db: AsyncSession, signup: Signup) -> Signup:
    """GM approves an offered signup → confirmed."""
    if signup.status != SignupStatus.offered:
        raise ValueError("Signup не в статусе offered")

    signup.status = SignupStatus.confirmed
    signup.offered_at = None

    await db.commit()
    await db.refresh(signup)
    return signup


async def reject_offered(db: AsyncSession, signup: Signup) -> Signup:
    """GM rejects an offered signup → back to waitlist position 1."""
    if signup.status != SignupStatus.offered:
        raise ValueError("Signup не в статусе offered")

    signup.status = SignupStatus.waitlist
    signup.waitlist_position = 1
    signup.offered_at = None

    await db.commit()
    await db.refresh(signup)
    return signup


async def auto_approve_expired_offers(db: AsyncSession, timeout_hours: int):
    """
    Auto-approve offered signups that exceeded timeout.
    Called by scheduler.
    """
    from datetime import timedelta

    cutoff = datetime.now(timezone.utc) - timedelta(hours=timeout_hours)

    result = await db.execute(
        select(Signup).where(
            and_(
                Signup.status == SignupStatus.offered,
                Signup.offered_at.isnot(None),
                Signup.offered_at <= cutoff,
            )
        )
    )
    expired_offers = list(result.scalars().all())

    for signup in expired_offers:
        signup.status = SignupStatus.confirmed
        signup.offered_at = None

    if expired_offers:
        await db.commit()

    return expired_offers


async def cancel_future_signups_for_campaign(
    db: AsyncSession, user_id: int, campaign_id: int
):
    """
    Cancel all future signups for a user in a campaign.
    Called when user leaves a campaign.
    """
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(Signup)
        .join(GameSession, Signup.session_id == GameSession.id)
        .where(
            and_(
                Signup.user_id == user_id,
                GameSession.campaign_id == campaign_id,
                GameSession.starts_at > now,
                Signup.status != SignupStatus.cancelled,
            )
        )
    )
    signups = list(result.scalars().all())

    confirmed_session_ids = []
    for signup in signups:
        if signup.status == SignupStatus.confirmed:
            confirmed_session_ids.append(signup.session_id)
        signup.status = SignupStatus.cancelled
        signup.waitlist_position = None

    if signups:
        await db.commit()

    # Process waitlist for sessions that lost a confirmed player
    for session_id in confirmed_session_ids:
        await process_waitlist(db, session_id)

    return signups