"""Seed rooms into the database."""
import asyncio
from app.database import async_session
from app.models.room import Room
from sqlalchemy import select


ROOMS = ["308", "312", "615"]


async def seed():
    async with async_session() as db:
        result = await db.execute(select(Room))
        existing = result.scalars().all()
        if existing:
            print(f"Already have {len(existing)} rooms. Deleting...")
            for r in existing:
                await db.delete(r)
            await db.commit()

        for name in ROOMS:
            db.add(Room(name=name, is_active=True))
            print(f"  + Room {name}")

        await db.commit()
        print(f"\n✅ Added {len(ROOMS)} rooms!")


if __name__ == "__main__":
    asyncio.run(seed())
