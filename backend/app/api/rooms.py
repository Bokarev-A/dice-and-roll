from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.room import Room
from app.schemas.room import RoomRead
from app.api.deps import get_current_user

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.get("/", response_model=list[RoomRead])
async def list_rooms(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List all active rooms."""
    result = await db.execute(
        select(Room).where(Room.is_active == True).order_by(Room.name)  # noqa: E712
    )
    return result.scalars().all()