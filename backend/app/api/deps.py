import logging
from typing import Optional

import httpx
from fastapi import Depends, HTTPException, Header, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.utils.telegram import validate_init_data
from app.config import settings

logger = logging.getLogger(__name__)


async def _fetch_telegram_photo(telegram_id: int) -> Optional[str]:
    """Fetch user profile photo URL via Bot API. Returns None on any failure."""
    try:
        proxy = settings.TELEGRAM_PROXY or None
        async with httpx.AsyncClient(timeout=5, **({"proxies": proxy} if proxy else {})) as client:
            r = await client.get(
                f"https://api.telegram.org/bot{settings.BOT_TOKEN}/getUserProfilePhotos",
                params={"user_id": telegram_id, "limit": 1},
            )
            data = r.json()
            if not data.get("ok"):
                return None
            photos = data["result"].get("photos", [])
            if not photos:
                return None
            # Take the largest size of the first photo
            file_id = photos[0][-1]["file_id"]

            r2 = await client.get(
                f"https://api.telegram.org/bot{settings.BOT_TOKEN}/getFile",
                params={"file_id": file_id},
            )
            data2 = r2.json()
            if not data2.get("ok"):
                return None
            file_path = data2["result"]["file_path"]
            return f"https://api.telegram.org/file/bot{settings.BOT_TOKEN}/{file_path}"
    except Exception as e:
        logger.warning("Could not fetch Telegram photo for %s: %s", telegram_id, e)
        return None


async def get_current_user(
    x_init_data: str = Header(..., alias="X-Init-Data"),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Authenticate user via Telegram WebApp initData header."""
    user_data = validate_init_data(x_init_data)
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Telegram initData",
        )

    telegram_id = user_data.get("id")
    if not telegram_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No user id in initData",
        )

    # Find or create user
    result = await db.execute(
        select(User).where(User.telegram_id == telegram_id)
    )
    user = result.scalar_one_or_none()

    # photo_url from initData (present only for public Telegram photos)
    photo_url_from_init = user_data.get("photo_url")

    if not user:
        # Determine role
        role = UserRole.player
        if telegram_id == settings.INITIAL_ADMIN_TELEGRAM_ID:
            role = UserRole.admin

        photo_url = photo_url_from_init or await _fetch_telegram_photo(telegram_id)

        user = User(
            telegram_id=telegram_id,
            first_name=user_data.get("first_name", ""),
            last_name=user_data.get("last_name"),
            username=user_data.get("username"),
            photo_url=photo_url,
            role=role,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        # Update profile info if changed
        changed = False
        for field in ("first_name", "last_name", "username"):
            new_val = user_data.get(field)
            if new_val is not None and getattr(user, field) != new_val:
                setattr(user, field, new_val)
                changed = True

        # Update photo: prefer initData value, fallback to Bot API if still missing
        new_photo = photo_url_from_init or (
            await _fetch_telegram_photo(telegram_id) if not user.photo_url else None
        )
        if new_photo and new_photo != user.photo_url:
            user.photo_url = new_photo
            changed = True

        if changed:
            await db.commit()
            await db.refresh(user)

    return user


def require_role(*roles: UserRole):
    """Dependency factory that checks user role."""

    async def checker(
        current_user: User = Depends(get_current_user),
    ) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required role: {', '.join(r.value for r in roles)}",
            )
        return current_user

    return checker


# Shortcuts
require_gm = require_role(UserRole.gm, UserRole.private_gm, UserRole.admin)
require_admin = require_role(UserRole.admin)