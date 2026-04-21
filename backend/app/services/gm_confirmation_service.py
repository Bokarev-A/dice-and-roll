import logging
from datetime import datetime, timezone, timedelta

import pytz
from sqlalchemy import select, update, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.campaign import Campaign
from app.models.session import GameSession, SessionStatus
from app.models.signup import Signup, SignupStatus
from app.models.user import User
from app.bot import notifications as bot
from app.services.notification_service import notify_session_participants
from app.services.signup_service import cancel_signup

logger = logging.getLogger(__name__)


# ── Scheduler job helper ─────────────────────────────────────────


async def send_gm_48h_notifications(db: AsyncSession) -> None:
    """
    Send 48h-ahead confirmation requests to GMs.
    Called by the scheduler every 15 minutes.
    Uses an atomic UPDATE...RETURNING to prevent duplicate sends when two
    processes run concurrently (e.g. during a rolling deploy).
    """
    now = datetime.now(timezone.utc)
    target = now + timedelta(hours=48)
    window = timedelta(minutes=15)

    result = await db.execute(
        update(GameSession)
        .where(
            and_(
                GameSession.starts_at >= target - window,
                GameSession.starts_at <= target + window,
                GameSession.status.in_([SessionStatus.planned, SessionStatus.moved]),
                GameSession.gm_48h_notified_at.is_(None),
            )
        )
        .values(gm_48h_notified_at=now)
        .returning(GameSession.id)
    )
    session_ids = [row[0] for row in result.fetchall()]
    await db.commit()

    if not session_ids:
        return

    tz = pytz.timezone(settings.CLUB_TIMEZONE)

    for session_id in session_ids:
        session = await db.get(GameSession, session_id)
        if not session:
            continue
        campaign = await db.get(Campaign, session.campaign_id)
        if not campaign:
            continue
        gm = await db.get(User, campaign.owner_gm_user_id)
        if not gm:
            continue

        starts_str = session.starts_at.astimezone(tz).strftime("%d.%m.%Y %H:%M")
        room_name = session.room.name if session.room else ""

        await bot.notify_gm_48h_confirmation(
            gm.telegram_id,
            campaign.title,
            starts_str,
            room_name,
            session_id,
        )

    logger.info("Sent 48h GM confirmation for %d sessions", len(session_ids))


# ── Shared helpers ───────────────────────────────────────────────


async def _verify_gm(db: AsyncSession, session: GameSession, from_telegram_id: int) -> User | None:
    """Return GM User if from_telegram_id matches campaign GM, else None."""
    campaign = await db.get(Campaign, session.campaign_id)
    if not campaign:
        return None
    gm = await db.get(User, campaign.owner_gm_user_id)
    if not gm or gm.telegram_id != from_telegram_id:
        logger.warning(
            "Webhook: sender %d is not GM of session %d", from_telegram_id, session.id
        )
        return None
    return gm


# ── Callback handlers ────────────────────────────────────────────


async def handle_gm_confirm(db: AsyncSession, session_id: int, from_user: dict) -> None:
    """GM confirmed the session — notify all confirmed players."""
    session = await db.get(GameSession, session_id)
    if not session or session.status not in (SessionStatus.planned, SessionStatus.moved):
        return

    gm = await _verify_gm(db, session, from_user["id"])
    if not gm:
        return

    if session.players_confirmed_at is not None:
        return  # idempotent: already sent

    campaign = await db.get(Campaign, session.campaign_id)
    tz = pytz.timezone(settings.CLUB_TIMEZONE)
    starts_str = session.starts_at.astimezone(tz).strftime("%d.%m.%Y %H:%M")
    room_name = session.room.name if session.room else ""

    result = await db.execute(
        select(Signup).where(
            and_(
                Signup.session_id == session_id,
                Signup.status == SignupStatus.confirmed,
            )
        )
    )
    signups = list(result.scalars().all())

    for signup in signups:
        player = await db.get(User, signup.user_id)
        if player:
            await bot.notify_player_confirm_attendance(
                player.telegram_id,
                campaign.title,
                starts_str,
                room_name,
                signup.id,
            )

    session.players_confirmed_at = datetime.now(timezone.utc)
    await db.commit()
    logger.info("GM confirmed session %d, notified %d players", session_id, len(signups))


async def handle_gm_move(db: AsyncSession, session_id: int, from_user: dict) -> None:
    """GM wants to reschedule — redirect to Mini App."""
    session = await db.get(GameSession, session_id)
    if not session:
        return

    gm = await _verify_gm(db, session, from_user["id"])
    if not gm:
        return

    await bot.notify_gm_reschedule_redirect(from_user["id"], settings.MINI_APP_URL)


async def handle_gm_cancel(db: AsyncSession, session_id: int, from_user: dict) -> None:
    """GM cancelled the session — update status and notify players."""
    session = await db.get(GameSession, session_id)
    if not session or session.status == SessionStatus.canceled:
        return

    gm = await _verify_gm(db, session, from_user["id"])
    if not gm:
        return

    session.status = SessionStatus.canceled
    await db.commit()
    await db.refresh(session)

    await notify_session_participants(db, session, "canceled")
    logger.info("GM cancelled session %d via webhook", session_id)


async def handle_player_ok(db: AsyncSession, signup_id: int, from_user: dict) -> None:
    """Player confirmed attendance — confirm pending signup if needed, then notify GM."""
    from app.services.signup_service import confirm_pending_signup

    signup = await db.get(Signup, signup_id)
    if not signup or signup.status == SignupStatus.cancelled:
        return

    player = await db.get(User, signup.user_id)
    if not player or player.telegram_id != from_user["id"]:
        logger.warning("Webhook: sender %d is not owner of signup %d", from_user["id"], signup_id)
        return

    if signup.status == SignupStatus.pending:
        await confirm_pending_signup(db, signup)

    session = await db.get(GameSession, signup.session_id)
    if not session:
        return
    campaign = await db.get(Campaign, session.campaign_id)
    if not campaign:
        return
    gm = await db.get(User, campaign.owner_gm_user_id)
    if not gm:
        return

    player_name = f"{player.first_name} {player.last_name or ''}".strip()
    action = "confirmed" if signup.status == SignupStatus.confirmed else "waitlisted"
    await bot.notify_gm_player_response(gm.telegram_id, player_name, campaign.title, action)


async def send_gm_6h_notifications(db: AsyncSession) -> None:
    """
    Send 6h-ahead confirmation requests to GMs.
    Called by the scheduler every 15 minutes.
    Uses an atomic UPDATE...RETURNING to prevent duplicate sends on concurrent runs.
    """
    now = datetime.now(timezone.utc)
    target = now + timedelta(hours=6)
    window = timedelta(minutes=15)

    result = await db.execute(
        update(GameSession)
        .where(
            and_(
                GameSession.starts_at >= target - window,
                GameSession.starts_at <= target + window,
                GameSession.status.in_([SessionStatus.planned, SessionStatus.moved]),
                GameSession.gm_6h_notified_at.is_(None),
            )
        )
        .values(gm_6h_notified_at=now)
        .returning(GameSession.id)
    )
    session_ids = [row[0] for row in result.fetchall()]
    await db.commit()

    if not session_ids:
        return

    tz = pytz.timezone(settings.CLUB_TIMEZONE)

    for session_id in session_ids:
        session = await db.get(GameSession, session_id)
        if not session:
            continue
        campaign = await db.get(Campaign, session.campaign_id)
        if not campaign:
            continue
        gm = await db.get(User, campaign.owner_gm_user_id)
        if not gm:
            continue

        starts_str = session.starts_at.astimezone(tz).strftime("%d.%m.%Y %H:%M")
        room_name = session.room.name if session.room else ""

        await bot.notify_gm_6h_confirmation(
            gm.telegram_id,
            campaign.title,
            starts_str,
            room_name,
            session_id,
        )

    logger.info("Sent 6h GM confirmation for %d sessions", len(session_ids))


async def handle_gm_6h_confirm(db: AsyncSession, session_id: int, from_user: dict) -> None:
    """GM confirmed 6h-ahead — send reminder with buttons to all confirmed players."""
    session = await db.get(GameSession, session_id)
    if not session or session.status not in (SessionStatus.planned, SessionStatus.moved):
        return

    gm = await _verify_gm(db, session, from_user["id"])
    if not gm:
        return

    if session.players_6h_reminded_at is not None:
        return  # idempotent: already sent

    campaign = await db.get(Campaign, session.campaign_id)
    tz = pytz.timezone(settings.CLUB_TIMEZONE)
    starts_str = session.starts_at.astimezone(tz).strftime("%d.%m.%Y %H:%M")
    room_name = session.room.name if session.room else ""

    result = await db.execute(
        select(Signup).where(
            and_(
                Signup.session_id == session_id,
                Signup.status == SignupStatus.confirmed,
            )
        )
    )
    signups = list(result.scalars().all())

    for signup in signups:
        player = await db.get(User, signup.user_id)
        if player:
            await bot.notify_player_6h_reminder(
                player.telegram_id,
                campaign.title,
                starts_str,
                room_name,
                signup.id,
            )

    session.players_6h_reminded_at = datetime.now(timezone.utc)
    await db.commit()
    logger.info("GM confirmed 6h for session %d, notified %d players", session_id, len(signups))


async def handle_gm_6h_cancel(db: AsyncSession, session_id: int, from_user: dict) -> None:
    """GM cancelled session at 6h checkpoint — update status and notify players."""
    session = await db.get(GameSession, session_id)
    if not session or session.status == SessionStatus.canceled:
        return

    gm = await _verify_gm(db, session, from_user["id"])
    if not gm:
        return

    session.status = SessionStatus.canceled
    await db.commit()
    await db.refresh(session)

    await notify_session_participants(db, session, "canceled")
    logger.info("GM cancelled session %d via 6h webhook", session_id)


async def handle_player_cancel(
    db: AsyncSession, signup_id: int, from_user: dict, reason: str = ""
) -> None:
    """Player cancelled signup — cancel in DB and notify GM."""
    signup = await db.get(Signup, signup_id)
    if not signup:
        return
    if signup.status == SignupStatus.cancelled:
        return  # idempotent

    player = await db.get(User, signup.user_id)
    if not player or player.telegram_id != from_user["id"]:
        logger.warning("Webhook: sender %d is not owner of signup %d", from_user["id"], signup_id)
        return

    session = await db.get(GameSession, signup.session_id)
    campaign = await db.get(Campaign, session.campaign_id) if session else None
    gm = await db.get(User, campaign.owner_gm_user_id) if campaign else None

    await cancel_signup(db, signup)

    if gm:
        player_name = f"{player.first_name} {player.last_name or ''}".strip()
        await bot.notify_gm_player_response(
            gm.telegram_id, player_name, campaign.title, "cancelled", reason=reason
        )
    logger.info("Player %d cancelled signup %d via webhook", player.id, signup_id)


# ── Admin GM credit approval ─────────────────────────────────────


async def handle_admin_gc_approve(
    db: AsyncSession, attendance_id: int, from_user: dict
) -> None:
    """Admin approved gm_reward credit deduction for a player."""
    from app.models.attendance import Attendance
    from app.services.credit_service import debit_gm_reward_credit, debit_credit, debit_credit_as_debt

    attendance = await db.get(Attendance, attendance_id)
    if not attendance or not attendance.gm_credit_pending:
        return  # Already handled — idempotent

    result = await db.execute(select(User).where(User.telegram_id == from_user["id"]))
    admin_user = result.scalar_one_or_none()
    admin_id = admin_user.id if admin_user else None

    entry = await debit_gm_reward_credit(db, attendance.user_id, attendance.session_id, admin_id)
    attendance.gm_credit_pending = False
    if entry is None:
        # No gm_reward left — fall back to regular credit
        entry = await debit_credit(db, attendance.user_id, attendance.session_id, admin_id)
        if entry is None:
            await debit_credit_as_debt(db, attendance.user_id, attendance.session_id, admin_id)
            attendance.unpaid = True
    await db.commit()

    user = await db.get(User, attendance.user_id)
    session = await db.get(GameSession, attendance.session_id)
    campaign = await db.get(Campaign, session.campaign_id) if session else None
    if user and campaign and session:
        tz = pytz.timezone(settings.CLUB_TIMEZONE)
        session_date = session.starts_at.astimezone(tz).strftime("%d.%m.%Y")
        if attendance.unpaid:
            await bot.notify_unpaid(user.telegram_id, campaign.title, session_date)
        else:
            await bot.notify_credit_deducted(user.telegram_id, campaign.title, session_date)

    logger.info(
        "Admin %s approved gm_reward deduction for attendance %d",
        from_user.get("id"), attendance_id,
    )


async def handle_admin_gc_deny(
    db: AsyncSession, attendance_id: int, from_user: dict
) -> None:
    """Admin denied gm_reward deduction — deduct regular credit instead."""
    from app.models.attendance import Attendance
    from app.services.credit_service import debit_credit, debit_credit_as_debt

    attendance = await db.get(Attendance, attendance_id)
    if not attendance or not attendance.gm_credit_pending:
        return  # Already handled — idempotent

    result = await db.execute(select(User).where(User.telegram_id == from_user["id"]))
    admin_user = result.scalar_one_or_none()
    admin_id = admin_user.id if admin_user else None

    entry = await debit_credit(db, attendance.user_id, attendance.session_id, admin_id)
    if entry is None:
        await debit_credit_as_debt(db, attendance.user_id, attendance.session_id, admin_id)
        attendance.unpaid = True
    attendance.gm_credit_pending = False
    await db.commit()

    user = await db.get(User, attendance.user_id)
    session = await db.get(GameSession, attendance.session_id)
    campaign = await db.get(Campaign, session.campaign_id) if session else None
    if user and campaign and session:
        tz = pytz.timezone(settings.CLUB_TIMEZONE)
        session_date = session.starts_at.astimezone(tz).strftime("%d.%m.%Y")
        if attendance.unpaid:
            await bot.notify_unpaid(user.telegram_id, campaign.title, session_date)
        else:
            await bot.notify_credit_deducted(user.telegram_id, campaign.title, session_date)

    logger.info(
        "Admin %s denied gm_reward deduction for attendance %d",
        from_user.get("id"), attendance_id,
    )
