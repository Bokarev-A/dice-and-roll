import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import settings
from app.database import async_session

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def job_expire_orders():
    """Expire pending orders older than configured hours."""
    from app.services.order_service import expire_orders

    async with async_session() as db:
        try:
            expired = await expire_orders(db, settings.ORDER_EXPIRY_HOURS)
            if expired:
                logger.info(f"Expired {len(expired)} orders")
        except Exception as e:
            logger.error(f"Error expiring orders: {e}")


async def job_expire_credits():
    """Mark expired credit batches and send notifications."""
    from app.services.credit_service import expire_batches
    from app.bot import notifications as bot
    from app.models.user import User

    async with async_session() as db:
        try:
            batches = await expire_batches(db)
            for batch in batches:
                user = await db.get(User, batch.user_id)
                if user:
                    await bot.notify_credits_expired(
                        user.telegram_id, batch.remaining
                    )
            if batches:
                logger.info(f"Expired {len(batches)} credit batches")
        except Exception as e:
            logger.error(f"Error expiring credits: {e}")


async def job_credits_expiring_warning():
    """Warn users about credits expiring in 7 days."""
    from app.services.credit_service import get_expiring_batches
    from app.bot import notifications as bot
    from app.models.user import User
    import pytz

    tz = pytz.timezone(settings.CLUB_TIMEZONE)

    async with async_session() as db:
        try:
            batches = await get_expiring_batches(db, days_ahead=7)
            for batch in batches:
                user = await db.get(User, batch.user_id)
                if user and batch.expires_at:
                    expires_str = batch.expires_at.astimezone(tz).strftime(
                        "%d.%m.%Y"
                    )
                    await bot.notify_credits_expiring(
                        user.telegram_id,
                        batch.remaining,
                        expires_str,
                    )
            if batches:
                logger.info(
                    f"Sent expiring warnings for {len(batches)} batches"
                )
        except Exception as e:
            logger.error(f"Error sending expiry warnings: {e}")


async def job_session_reminders():
    """Send session reminders."""
    from app.services.notification_service import send_session_reminders

    async with async_session() as db:
        try:
            for hours in settings.reminder_hours:
                await send_session_reminders(db, hours)
        except Exception as e:
            logger.error(f"Error sending reminders: {e}")


async def job_auto_approve_offers():
    """Auto-approve offered signups past timeout."""
    from app.services.signup_service import auto_approve_expired_offers

    async with async_session() as db:
        try:
            approved = await auto_approve_expired_offers(
                db, settings.OFFERED_TIMEOUT_HOURS
            )
            if approved:
                logger.info(
                    f"Auto-approved {len(approved)} offered signups"
                )
        except Exception as e:
            logger.error(f"Error auto-approving offers: {e}")


async def job_gm_48h_confirmation():
    """Send 48h-ahead confirmation requests to GMs."""
    from app.services.gm_confirmation_service import send_gm_48h_notifications

    async with async_session() as db:
        try:
            await send_gm_48h_notifications(db)
        except Exception as e:
            logger.error(f"Error in GM 48h confirmation job: {e}")


async def job_attendance_reminders():
    """Remind GMs to mark attendance for old sessions."""
    from app.services.attendance_service import get_unmarked_sessions
    from app.bot import notifications as bot
    from app.models.campaign import Campaign
    from app.models.user import User
    import pytz

    tz = pytz.timezone(settings.CLUB_TIMEZONE)

    async with async_session() as db:
        try:
            sessions = await get_unmarked_sessions(
                db, settings.ATTENDANCE_WINDOW_HOURS
            )
            for session in sessions:
                campaign = await db.get(Campaign, session.campaign_id)
                if not campaign:
                    continue
                gm = await db.get(User, campaign.owner_gm_user_id)
                if not gm:
                    continue

                session_date = session.starts_at.astimezone(tz).strftime(
                    "%d.%m.%Y"
                )
                await bot.notify_attendance_reminder(
                    gm.telegram_id,
                    campaign.title,
                    session.id,
                    session_date,
                )
            if sessions:
                logger.info(
                    f"Sent attendance reminders for {len(sessions)} sessions"
                )
        except Exception as e:
            logger.error(f"Error sending attendance reminders: {e}")


def start_scheduler():
    """Configure and start the scheduler."""
    # Every 10 minutes: expire orders, auto-approve offers
    scheduler.add_job(job_expire_orders, "interval", minutes=10)
    scheduler.add_job(job_auto_approve_offers, "interval", minutes=10)

    # Every 15 minutes: session reminders, GM 48h confirmations
    scheduler.add_job(job_session_reminders, "interval", minutes=15)
    scheduler.add_job(job_gm_48h_confirmation, "interval", minutes=15)

    # Daily at 3:00 AM: expire credits, send warnings, attendance reminders
    scheduler.add_job(job_expire_credits, "cron", hour=3, minute=0)
    scheduler.add_job(job_credits_expiring_warning, "cron", hour=10, minute=0)
    scheduler.add_job(job_attendance_reminders, "cron", hour=9, minute=0)

    scheduler.start()
    logger.info("Scheduler started")


def stop_scheduler():
    """Stop the scheduler."""
    scheduler.shutdown()
    logger.info("Scheduler stopped")