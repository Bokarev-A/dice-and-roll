import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.bot.notifications import _tg_client
from app.services.gm_confirmation_service import (
    handle_gm_cancel,
    handle_gm_confirm,
    handle_gm_move,
    handle_player_cancel,
    handle_player_ok,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["bot-webhook"])

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

    try:
        if data.startswith("gm_ok_"):
            await handle_gm_confirm(db, int(data[6:]), from_user)
            toast_text = "✅ Сессия подтверждена, игроки уведомлены"
        elif data.startswith("gm_mv_"):
            await handle_gm_move(db, int(data[6:]), from_user)
            toast_text = "📅 Откройте приложение для переноса"
        elif data.startswith("gm_no_"):
            await handle_gm_cancel(db, int(data[6:]), from_user)
            toast_text = "❌ Сессия отменена, игроки уведомлены"
            show_alert = True
        elif data.startswith("pl_ok_"):
            await handle_player_ok(db, int(data[6:]), from_user)
            toast_text = "✅ Явка подтверждена!"
        elif data.startswith("pl_no_"):
            await handle_player_cancel(db, int(data[6:]), from_user)
            toast_text = "❌ Запись отменена"
        else:
            logger.debug("Unknown callback data: %s", data)
    except Exception:
        logger.exception("Error handling callback: %s", data)
        toast_text = "⚠️ Произошла ошибка, попробуйте в приложении"
        show_alert = True

    await answer_callback_query(callback["id"], toast_text, show_alert)

    if chat_id and message_id and toast_text:
        await remove_inline_keyboard(chat_id, message_id)

    return {"ok": True}
