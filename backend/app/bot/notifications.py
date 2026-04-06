import logging
from typing import Optional, List

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

BOT_API_URL = f"https://api.telegram.org/bot{settings.BOT_TOKEN}"


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
            async with httpx.AsyncClient(timeout=10) as client:
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


async def notify_new_member(
    gm_telegram_id: int,
    player_name: str,
    campaign_title: str,
):
    text = (
        f"👤 <b>Новый участник</b>\n\n"
        f"Игрок: {player_name}\n"
        f"Кампания: {campaign_title}"
    )
    await send_message(gm_telegram_id, text)


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