import logging
from typing import Optional, List

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

BOT_API_URL = f"https://api.telegram.org/bot{settings.BOT_TOKEN}"


def _tg_client(timeout: int = 10) -> httpx.AsyncClient:
    """Create an httpx client with optional proxy from settings."""
    kwargs: dict = {"timeout": timeout}
    if settings.TELEGRAM_PROXY:
        kwargs["proxies"] = settings.TELEGRAM_PROXY
    return httpx.AsyncClient(**kwargs)


async def send_message(
    chat_id: int,
    text: str,
    reply_markup: Optional[dict] = None,
    parse_mode: str = "HTML",
) -> bool:
    """Send a message via Telegram Bot API."""
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": parse_mode,
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup

    for attempt in range(3):
        try:
            async with _tg_client(timeout=10) as client:
                resp = await client.post(
                    f"{BOT_API_URL}/sendMessage", json=payload
                )
                if resp.status_code == 200:
                    return True
                logger.error(
                    f"Telegram API error (attempt {attempt + 1}): "
                    f"{resp.status_code} {resp.text}"
                )
        except Exception as e:
            logger.error(
                f"Failed to send message to {chat_id} "
                f"(attempt {attempt + 1}): {e}"
            )

    return False


# ── Order notifications ──────────────────────────────────────────


async def notify_admins_new_order(
    admin_telegram_ids: List[int],
    player_name: str,
    player_username: Optional[str],
    product_name: str,
    amount: float,
    order_id: int,
):
    """Notify all admins about a new order awaiting confirmation."""
    username_str = f"@{player_username}" if player_username else "нет username"
    text = (
        f"💳 <b>Новая оплата ожидает подтверждения</b>\n\n"
        f"Игрок: {player_name} ({username_str})\n"
        f"Товар: {product_name}\n"
        f"Сумма: {amount:.0f} ₽\n"
        f"Заказ: #{order_id}\n\n"
        f"Подтвердите в приложении."
    )
    for admin_id in admin_telegram_ids:
        await send_message(admin_id, text)


async def notify_order_confirmed(
    telegram_id: int,
    product_name: str,
    credits_count: int,
):
    text = (
        f"✅ <b>Оплата подтверждена!</b>\n\n"
        f"Товар: {product_name}\n"
        f"Начислено кредитов: {credits_count}\n\n"
        f"Хороших игр! 🎲"
    )
    await send_message(telegram_id, text)


async def notify_order_rejected(
    telegram_id: int,
    product_name: str,
    reason: str,
):
    text = (
        f"❌ <b>Оплата отклонена</b>\n\n"
        f"Товар: {product_name}\n"
        f"Причина: {reason}\n\n"
        f"Если вы уверены, что оплатили, свяжитесь с администратором."
    )
    await send_message(telegram_id, text)


# ── Session notifications ────────────────────────────────────────


async def notify_session_reminder(
    telegram_id: int,
    campaign_title: str,
    starts_at: str,
    room: str,
    hours: int,
):
    if hours >= 24 and hours % 24 == 0:
        days = hours // 24
        time_left = f"{days} дн."
    else:
        time_left = f"{hours} ч."

    text = (
        f"⏰ <b>Напоминание о сессии</b>\n\n"
        f"Кампания: {campaign_title}\n"
        f"Время: {starts_at}\n"
        f"Комната: {room}\n"
        f"До начала: {time_left}"
    )
    await send_message(telegram_id, text)


async def notify_session_moved(
    telegram_id: int,
    campaign_title: str,
    old_time: str,
    new_time: str,
    room: str,
):
    text = (
        f"🔄 <b>Сессия перенесена</b>\n\n"
        f"Кампания: {campaign_title}\n"
        f"Было: {old_time}\n"
        f"Стало: {new_time}\n"
        f"Комната: {room}"
    )
    await send_message(telegram_id, text)


async def notify_session_canceled(
    telegram_id: int,
    campaign_title: str,
    was_time: str,
):
    text = (
        f"🚫 <b>Сессия отменена</b>\n\n"
        f"Кампания: {campaign_title}\n"
        f"Была запланирована: {was_time}"
    )
    await send_message(telegram_id, text)


async def notify_new_session(
    telegram_id: int,
    campaign_title: str,
    starts_at: str,
    room: str,
):
    text = (
        f"🎲 <b>Новая сессия</b>\n\n"
        f"Кампания: {campaign_title}\n"
        f"Время: {starts_at}\n"
        f"Комната: {room}\n\n"
        f"Запишитесь в приложении!"
    )
    await send_message(telegram_id, text)


# ── Signup notifications ─────────────────────────────────────────


async def notify_offered_place(
    gm_telegram_id: int,
    player_name: str,
    campaign_title: str,
    session_id: int,
):
    text = (
        f"📋 <b>Место предложено игроку</b>\n\n"
        f"Игрок: {player_name}\n"
        f"Кампания: {campaign_title}\n"
        f"Сессия: #{session_id}\n\n"
        f"Подтвердите или отклоните в приложении."
    )
    await send_message(gm_telegram_id, text)


async def notify_offered_reminder(
    gm_telegram_id: int,
    player_name: str,
    campaign_title: str,
    session_id: int,
):
    text = (
        f"⏳ <b>Напоминание: место ожидает решения</b>\n\n"
        f"Игрок: {player_name}\n"
        f"Кампания: {campaign_title}\n"
        f"Сессия: #{session_id}\n\n"
        f"Примите решение в приложении."
    )
    await send_message(gm_telegram_id, text)


async def notify_signup_confirmed(
    telegram_id: int,
    campaign_title: str,
    starts_at: str,
):
    text = (
        f"✅ <b>Ваша запись подтверждена!</b>\n\n"
        f"Кампания: {campaign_title}\n"
        f"Время: {starts_at}"
    )
    await send_message(telegram_id, text)


# ── Campaign notifications ───────────────────────────────────────


async def notify_new_application(
    gm_telegram_id: int,
    player_name: str,
    campaign_title: str,
):
    text = (
        f"📋 <b>Новая заявка на вступление</b>\n\n"
        f"Игрок: {player_name}\n"
        f"Кампания: {campaign_title}"
    )
    await send_message(gm_telegram_id, text)


async def notify_application_approved(
    player_telegram_id: int,
    campaign_title: str,
):
    text = (
        f"✅ <b>Заявка одобрена</b>\n\n"
        f"Ваша заявка на вступление в кампанию «{campaign_title}» одобрена!"
    )
    await send_message(player_telegram_id, text)


async def notify_application_rejected(
    player_telegram_id: int,
    campaign_title: str,
):
    text = (
        f"❌ <b>Заявка отклонена</b>\n\n"
        f"Ваша заявка на вступление в кампанию «{campaign_title}» была отклонена."
    )
    await send_message(player_telegram_id, text)


# ── Attendance notifications ─────────────────────────────────────


async def notify_unpaid(
    telegram_id: int,
    campaign_title: str,
    session_date: str,
):
    text = (
        f"💰 <b>Неоплаченное посещение</b>\n\n"
        f"Кампания: {campaign_title}\n"
        f"Дата: {session_date}\n\n"
        f"Пожалуйста, приобретите кредит для оплаты."
    )
    await send_message(telegram_id, text)


async def notify_attendance_reminder(
    gm_telegram_id: int,
    campaign_title: str,
    session_id: int,
    session_date: str,
):
    text = (
        f"📝 <b>Отметьте посещаемость</b>\n\n"
        f"Кампания: {campaign_title}\n"
        f"Сессия #{session_id} от {session_date}\n\n"
        f"Посещаемость не отмечена более 48 часов."
    )
    await send_message(gm_telegram_id, text)


# ── Credit notifications ─────────────────────────────────────────


async def notify_credits_expiring(
    telegram_id: int,
    remaining: int,
    expires_at: str,
):
    text = (
        f"⚠️ <b>Абонемент скоро истекает</b>\n\n"
        f"Осталось кредитов: {remaining}\n"
        f"Истекает: {expires_at}\n\n"
        f"Используйте кредиты или продлите абонемент."
    )
    await send_message(telegram_id, text)


async def notify_credits_expired(
    telegram_id: int,
    expired_count: int,
):
    text = (
        f"❌ <b>Абонемент истёк</b>\n\n"
        f"Сгорело кредитов: {expired_count}\n\n"
        f"Приобретите новый абонемент для продолжения игр."
    )
    await send_message(telegram_id, text)


# ── 48h GM confirmation flow ─────────────────────────────────────


async def notify_gm_48h_confirmation(
    telegram_id: int,
    campaign_title: str,
    starts_at_str: str,
    room_name: str,
    session_id: int,
):
    text = (
        f"📋 <b>Подтвердите проведение сессии</b>\n\n"
        f"Кампания: {campaign_title}\n"
        f"Время: {starts_at_str}\n"
        f"Комната: {room_name}\n\n"
        f"Сессия через 2 дня. Подтвердите, перенесите или отмените."
    )
    reply_markup = {
        "inline_keyboard": [[
            {"text": "✅ Подтвердить", "callback_data": f"gm_ok_{session_id}"},
            {"text": "📅 Перенести",   "callback_data": f"gm_mv_{session_id}"},
            {"text": "❌ Отменить",    "callback_data": f"gm_no_{session_id}"},
        ]]
    }
    await send_message(telegram_id, text, reply_markup=reply_markup)


async def notify_player_confirm_attendance(
    telegram_id: int,
    campaign_title: str,
    starts_at_str: str,
    room_name: str,
    signup_id: int,
):
    text = (
        f"⏰ <b>Подтвердите участие в сессии</b>\n\n"
        f"Кампания: {campaign_title}\n"
        f"Время: {starts_at_str}\n"
        f"Комната: {room_name}\n\n"
        f"Планируете прийти?"
    )
    reply_markup = {
        "inline_keyboard": [[
            {"text": "✅ Буду",            "callback_data": f"pl_ok_{signup_id}"},
            {"text": "❌ Отменить запись", "callback_data": f"pl_no_{signup_id}"},
        ]]
    }
    await send_message(telegram_id, text, reply_markup=reply_markup)


async def notify_gm_player_response(
    gm_telegram_id: int,
    player_name: str,
    campaign_title: str,
    action: str,
):
    if action == "confirmed":
        text = (
            f"✅ <b>{player_name}</b> подтвердил(а) явку\n"
            f"Кампания: {campaign_title}"
        )
    else:
        text = (
            f"❌ <b>{player_name}</b> отменил(а) запись\n"
            f"Кампания: {campaign_title}"
        )
    await send_message(gm_telegram_id, text)


async def notify_gm_reschedule_redirect(
    gm_telegram_id: int,
    mini_app_url: str,
):
    text = (
        f"📅 <b>Перенос сессии</b>\n\n"
        f"Для изменения времени и комнаты воспользуйтесь приложением."
    )
    if mini_app_url:
        text += f"\n\n<a href=\"{mini_app_url}\">Открыть приложение</a>"
    await send_message(gm_telegram_id, text)


async def register_webhook() -> None:
    """Register Telegram webhook on app startup."""
    from app.config import settings

    payload = {
        "url": settings.WEBHOOK_URL,
        "allowed_updates": ["callback_query"],
    }
    if settings.WEBHOOK_SECRET:
        payload["secret_token"] = settings.WEBHOOK_SECRET

    import logging
    logger = logging.getLogger(__name__)

    async with _tg_client(timeout=10) as client:
        resp = await client.post(f"{BOT_API_URL}/setWebhook", json=payload)
    if resp.status_code == 200 and resp.json().get("ok"):
        logger.info("Telegram webhook registered: %s", settings.WEBHOOK_URL)
    else:
        logger.error("Failed to register Telegram webhook: %s", resp.text)