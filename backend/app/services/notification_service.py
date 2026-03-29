from datetime import datetime, timezone, timedelta

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.models.signup import Signup, SignupStatus
from app.models.session import GameSession
from app.models.campaign import Campaign
from app.bot import notifications as bot


async def get_admin_telegram_ids(db: AsyncSession) -> list[int]:
    """Get telegram IDs of all admins."""
    result = await db.execute(
        select(User.telegram_id).where(User.role == UserRole.admin)
    )
    return list(result.scalars().all())


async def notify_session_participants(
    db: AsyncSession,
    session: GameSession,
    notification_type: str,
    old_starts_at: datetime | None = None,
):
    """
    Send notifications to all confirmed/waitlist/offered participants.
    notification_type: 'moved', 'canceled', 'reminder'
    """
    result = await db.execute(
        select(Signup)
        .where(
            and_(
                Signup.session_id == session.id,
                Signup.status.in_([
                    SignupStatus.confirmed,
                    SignupStatus.waitlist,
                    SignupStatus.offered,
                ]),
            )
        )
    )
    signups = result.scalars().all()

    campaign = await db.get(Campaign, session.campaign_id)
    campaign_title = campaign.title if campaign else "Неизвестная кампания"

    from app.config import settings
    import pytz

    tz = pytz.timezone(settings.CLUB_TIMEZONE)

    for signup in signups:
        user = await db.get(User, signup.user_id)
        if not user:
            continue

        starts_str = session.starts_at.astimezone(tz).strftime(
            "%d.%m.%Y %H:%M"
        )
        room_name = ""
        if session.room:
            room_name = session.room.name

        if notification_type == "canceled":
            await bot.notify_session_canceled(
                user.telegram_id, campaign_title, starts_str
            )
        elif notification_type == "moved" and old_starts_at:
            old_str = old_starts_at.astimezone(tz).strftime(
                "%d.%m.%Y %H:%M"
            )
            await bot.notify_session_moved(
                user.telegram_id,
                campaign_title,
                old_str,
                starts_str,
                room_name,
            )


async def notify_campaign_members_new_session(
    db: AsyncSession, session: GameSession
):
    """Notify all campaign members about a new session."""
    from app.models.campaign import CampaignMember

    campaign = await db.get(Campaign, session.campaign_id)
    if not campaign:
        return

    result = await db.execute(
        select(CampaignMember).where(
            CampaignMember.campaign_id == session.campaign_id
        )
    )
    members = result.scalars().all()

    from app.config import settings
    import pytz

    tz = pytz.timezone(settings.CLUB_TIMEZONE)
    starts_str = session.starts_at.astimezone(tz).strftime(
        "%d.%m.%Y %H:%M"
    )

    room_name = ""
    if session.room:
        room_name = session.room.name

    for member in members:
        user = await db.get(User, member.user_id)
        if user:
            await bot.notify_new_session(
                user.telegram_id,
                campaign.title,
                starts_str,
                room_name,
            )


async def send_session_reminders(
    db: AsyncSession, hours_before: int
):
    """
    Send reminders for sessions starting in N hours.
    Called by scheduler.
    """
    now = datetime.now(timezone.utc)
    target_start = now + timedelta(hours=hours_before)
    window = timedelta(minutes=15)

    result = await db.execute(
        select(GameSession).where(
            and_(
                GameSession.starts_at >= target_start - window,
                GameSession.starts_at <= target_start + window,
                GameSession.status.in_(["planned", "moved"]),
            )
        )
    )
    sessions = result.scalars().all()

    from app.config import settings
    import pytz

    tz = pytz.timezone(settings.CLUB_TIMEZONE)

    for session in sessions:
        signups_result = await db.execute(
            select(Signup).where(
                and_(
                    Signup.session_id == session.id,
                    Signup.status == SignupStatus.confirmed,
                )
            )
        )
        signups = signups_result.scalars().all()

        campaign = await db.get(Campaign, session.campaign_id)
        campaign_title = campaign.title if campaign else ""

        starts_str = session.starts_at.astimezone(tz).strftime(
            "%d.%m.%Y %H:%M"
        )
        room_name = ""
        if session.room:
            room_name = session.room.name

        for signup in signups:
            user = await db.get(User, signup.user_id)
            if user:
                await bot.notify_session_reminder(
                    user.telegram_id,
                    campaign_title,
                    starts_str,
                    room_name,
                    hours_before,
                )