from fastapi import Depends, HTTPException, Header, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.utils.telegram import validate_init_data
from app.config import settings


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

    if not user:
        # Determine role
        role = UserRole.player
        if telegram_id == settings.INITIAL_ADMIN_TELEGRAM_ID:
            role = UserRole.admin

        user = User(
            telegram_id=telegram_id,
            first_name=user_data.get("first_name", ""),
            last_name=user_data.get("last_name"),
            username=user_data.get("username"),
            photo_url=user_data.get("photo_url"),
            role=role,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        # Update profile info if changed
        changed = False
        for field in ("first_name", "last_name", "username", "photo_url"):
            new_val = user_data.get(field)
            if new_val is not None and getattr(user, field) != new_val:
                setattr(user, field, new_val)
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
require_gm = require_role(UserRole.gm, UserRole.admin)
require_admin = require_role(UserRole.admin)