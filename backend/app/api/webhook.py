import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
import re

from app.bot.notifications import _tg_client, ask_player_cancel_reason
from app.services.gm_confirmation_service import (
    handle_gm_cancel,
    handle_gm_confirm,
    handle_gm_move,
    handle_gm_6h_confirm,
    handle_gm_6h_cancel,
    handle_player_cancel,
    handle_player_ok,
    handle_admin_gc_approve,
    handle_admin_gc_deny,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["bot-webhook"])

CANCEL_REASONS: dict[str, str] = {
    "1": "Болею 🤒",
    "2": "Занят/занята 💼",
    "3": "Уезжаю ✈️",
    "0": "Без причины",
}

BOT_API_URL = f"{settings.TELEGRAM_BOT_API_URL}/bot{settings.BOT_TOKEN}"


async def answer_callback_query(
    callback_id: str,
    text: str = "",
    show_alert: bool = False,
) -> None:
    """Dismiss the Telegram loading spinner, optionally showing a toast."""
    payload: dict = {"callback_query_id": callback_id}
    if text:
        payload["text"] = text
        payload["show_alert"] = show_alert
    try:
        async with _tg_client(timeout=5) as client:
            await client.post(f"{BOT_API_URL}/answerCallbackQuery", json=payload)
    except Exception:
        pass  # best-effort


async def remove_inline_keyboard(chat_id: int, message_id: int) -> None:
    """Remove inline keyboard from a message after the action is handled."""
    try:
        async with _tg_client(timeout=5) as client:
            await client.post(
                f"{BOT_API_URL}/editMessageReplyMarkup",
                json={
                    "chat_id": chat_id,
                    "message_id": message_id,
                    "reply_markup": {"inline_keyboard": []},
                },
            )
    except Exception:
        pass  # best-effort


async def set_keyboard_status(
    chat_id: int, message_id: int, status_text: str, signup_id: int
) -> None:
    """Replace inline keyboard with status row + change button."""
    try:
        async with _tg_client(timeout=5) as client:
            await client.post(
                f"{BOT_API_URL}/editMessageReplyMarkup",
                json={
                    "chat_id": chat_id,
                    "message_id": message_id,
                    "reply_markup": {
                        "inline_keyboard": [
                            [{"text": status_text, "callback_data": "noop"}],
                            [{"text": "✏️ Изменить", "callback_data": f"pl_chg_{signup_id}"}],
                        ]
                    },
                },
            )
    except Exception:
        pass  # best-effort


async def set_gm_keyboard_status(chat_id: int, message_id: int, status_text: str) -> None:
    """Replace GM inline keyboard with a single non-clickable status row."""
    try:
        async with _tg_client(timeout=5) as client:
            await client.post(
                f"{BOT_API_URL}/editMessageReplyMarkup",
                json={
                    "chat_id": chat_id,
                    "message_id": message_id,
                    "reply_markup": {
                        "inline_keyboard": [
                            [{"text": status_text, "callback_data": "noop"}],
                        ]
                    },
                },
            )
    except Exception:
        pass  # best-effort


async def restore_player_keyboard(chat_id: int, message_id: int, signup_id: int) -> None:
    """Restore the original attendance confirmation keyboard."""
    try:
        async with _tg_client(timeout=5) as client:
            await client.post(
                f"{BOT_API_URL}/editMessageReplyMarkup",
                json={
                    "chat_id": chat_id,
                    "message_id": message_id,
                    "reply_markup": {
                        "inline_keyboard": [[
                            {"text": "✅ Буду",      "callback_data": f"pl_ok_{signup_id}"},
                            {"text": "❌ Не смогу", "callback_data": f"pl_why_{signup_id}"},
                        ]]
                    },
                },
            )
    except Exception:
        pass  # best-effort


async def show_cancel_reasons_keyboard(chat_id: int, message_id: int, signup_id: int) -> None:
    """Show reason selection keyboard when player wants to cancel."""
    rows = [
        [{"text": label, "callback_data": f"pl_rsn_{signup_id}_{key}"}]
        for key, label in CANCEL_REASONS.items()
    ]
    rows.append([{"text": "✏️ Другая причина", "callback_data": f"pl_other_{signup_id}"}])
    rows.append([{"text": "↩ Назад", "callback_data": f"pl_chg_{signup_id}"}])
    try:
        async with _tg_client(timeout=5) as client:
            await client.post(
                f"{BOT_API_URL}/editMessageReplyMarkup",
                json={
                    "chat_id": chat_id,
                    "message_id": message_id,
                    "reply_markup": {"inline_keyboard": rows},
                },
            )
    except Exception:
        pass  # best-effort


@router.post("/webhook")
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str | None = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Receive Telegram callback_query updates."""
    if settings.WEBHOOK_SECRET and x_telegram_bot_api_secret_token != settings.WEBHOOK_SECRET:
        raise HTTPException(status_code=403)

    body = await request.json()

    # Handle player typing a custom cancellation reason (reply to force_reply message)
    incoming_message = body.get("message")
    if incoming_message and incoming_message.get("reply_to_message"):
        reply_to_text = incoming_message["reply_to_message"].get("text", "")
        match = re.search(r"#signup_(\d+)", reply_to_text)
        if match:
            signup_id = int(match.group(1))
            reason = incoming_message.get("text", "").strip()
            from_user = incoming_message["from"]
            try:
                await handle_player_cancel(db, signup_id, from_user, reason=reason)
            except Exception:
                logger.exception("Error handling cancel-with-reason for signup %d", signup_id)
        return {"ok": True}

    callback = body.get("callback_query")
    if not callback:
        return {"ok": True}

    data = callback.get("data", "")
    from_user = callback["from"]
    message = callback.get("message", {})
    chat_id = message.get("chat", {}).get("id")
    message_id = message.get("message_id")

    toast_text = ""
    show_alert = False
    keyboard_already_updated = False

    try:
        if data.startswith("gm_ok_"):
            await handle_gm_confirm(db, int(data[6:]), from_user)
            toast_text = "✅ Сессия подтверждена, игроки уведомлены"
            if chat_id and message_id:
                await set_gm_keyboard_status(chat_id, message_id, "✅ Игра подтверждена")
                keyboard_already_updated = True
        elif data.startswith("gm_mv_"):
            await handle_gm_move(db, int(data[6:]), from_user)
            toast_text = "📅 Откройте приложение для переноса"
            if chat_id and message_id:
                await set_gm_keyboard_status(chat_id, message_id, "📅 Перенос запрошен")
                keyboard_already_updated = True
        elif data.startswith("gm_no_"):
            await handle_gm_cancel(db, int(data[6:]), from_user)
            toast_text = "❌ Сессия отменена, игроки уведомлены"
            show_alert = True
            if chat_id and message_id:
                await set_gm_keyboard_status(chat_id, message_id, "❌ Игра отменена")
                keyboard_already_updated = True
        elif data.startswith("gm6_ok_"):
            await handle_gm_6h_confirm(db, int(data[7:]), from_user)
            toast_text = "✅ Игроки получили напоминание"
            if chat_id and message_id:
                await set_gm_keyboard_status(chat_id, message_id, "✅ Игра подтверждена")
                keyboard_already_updated = True
        elif data.startswith("gm6_no_"):
            await handle_gm_6h_cancel(db, int(data[7:]), from_user)
            toast_text = "❌ Сессия отменена, игроки уведомлены"
            show_alert = True
            if chat_id and message_id:
                await set_gm_keyboard_status(chat_id, message_id, "❌ Игра отменена")
                keyboard_already_updated = True
        elif data.startswith("pl_ok_"):
            signup_id = int(data[6:])
            await handle_player_ok(db, signup_id, from_user)
            toast_text = "✅ Явка подтверждена!"
            if chat_id and message_id:
                await set_keyboard_status(chat_id, message_id, "✅ Явка подтверждена", signup_id)
                keyboard_already_updated = True
        elif data.startswith("pl_why_"):
            signup_id = int(data[7:])
            toast_text = "Укажите причину"
            if chat_id and message_id:
                await show_cancel_reasons_keyboard(chat_id, message_id, signup_id)
                keyboard_already_updated = True
        elif data.startswith("pl_rsn_"):
            parts = data[7:].rsplit("_", 1)
            signup_id, reason_key = int(parts[0]), parts[1]
            reason = CANCEL_REASONS.get(reason_key, "")
            await handle_player_cancel(db, signup_id, from_user, reason=reason)
            toast_text = "❌ Запись отменена"
            if chat_id and message_id:
                label = f"❌ Запись отменена" + (f" — {reason}" if reason else "")
                await set_keyboard_status(chat_id, message_id, label, signup_id)
                keyboard_already_updated = True
        elif data.startswith("pl_other_"):
            signup_id = int(data[9:])
            toast_text = "Напишите причину в ответ на следующее сообщение"
            if chat_id and message_id:
                await set_keyboard_status(chat_id, message_id, "⏳ Ожидаем вашу причину...", signup_id)
                keyboard_already_updated = True
            await ask_player_cancel_reason(from_user["id"], signup_id)
        elif data.startswith("pl_chg_"):
            signup_id = int(data[7:])
            toast_text = "Выберите действие"
            if chat_id and message_id:
                await restore_player_keyboard(chat_id, message_id, signup_id)
                keyboard_already_updated = True
        elif data == "noop":
            pass  # status button tap — do nothing
        elif data.startswith("adm_gc_ok_"):
            await handle_admin_gc_approve(db, int(data[10:]), from_user)
            toast_text = "✅ Мастерский кредит списан"
        elif data.startswith("adm_gc_no_"):
            await handle_admin_gc_deny(db, int(data[10:]), from_user)
            toast_text = "❌ Списан обычный кредит"
        else:
            logger.debug("Unknown callback data: %s", data)
    except Exception:
        logger.exception("Error handling callback: %s", data)
        toast_text = "⚠️ Произошла ошибка, попробуйте в приложении"
        show_alert = True

    await answer_callback_query(callback["id"], toast_text, show_alert)

    if chat_id and message_id and toast_text and not keyboard_already_updated:
        await remove_inline_keyboard(chat_id, message_id)

    return {"ok": True}
