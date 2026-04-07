import logging

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.services.gm_confirmation_service import (
    handle_gm_cancel,
    handle_gm_confirm,
    handle_gm_move,
    handle_player_cancel,
    handle_player_ok,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["bot-webhook"])

BOT_API_URL = f"https://api.telegram.org/bot{settings.BOT_TOKEN}"


async def answer_callback_query(callback_id: str) -> None:
    """Dismiss the Telegram loading spinner."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(
                f"{BOT_API_URL}/answerCallbackQuery",
                json={"callback_query_id": callback_id},
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

    await answer_callback_query(callback["id"])

    data = callback.get("data", "")
    from_user = callback["from"]

    try:
        if data.startswith("gm_ok_"):
            await handle_gm_confirm(db, int(data[6:]), from_user)
        elif data.startswith("gm_mv_"):
            await handle_gm_move(db, int(data[6:]), from_user)
        elif data.startswith("gm_no_"):
            await handle_gm_cancel(db, int(data[6:]), from_user)
        elif data.startswith("pl_ok_"):
            await handle_player_ok(db, int(data[6:]), from_user)
        elif data.startswith("pl_no_"):
            await handle_player_cancel(db, int(data[6:]), from_user)
        else:
            logger.debug("Unknown callback data: %s", data)
    except Exception:
        logger.exception("Error handling callback: %s", data)

    return {"ok": True}
