"""Seed products into the database."""
import asyncio
from app.database import engine, async_session, Base
from app.models.product import Product
from sqlalchemy import select


PRODUCTS = [
    {
        "name": "Разовая игра",
        "price": 700.00,
        "credits": 1,
        "duration_months": None,
    },
    {
        "name": "Абонемент 4 игры",
        "price": 2395.00,
        "credits": 4,
        "duration_months": 2,
    },
    {
        "name": "Абонемент 8 игр",
        "price": 4715.00,
        "credits": 8,
        "duration_months": 3,
    },
    {
        "name": "Абонемент 12 игр",
        "price": 6915.00,
        "credits": 12,
        "duration_months": 4,
    },
    {
        "name": "Абонемент 16 игр",
        "price": 8850.00,
        "credits": 16,
        "duration_months": 5,
    },
    {
        "name": "Абонемент 20 игр",
        "price": 9955.00,
        "credits": 20,
        "duration_months": 7,
    },
]


async def seed():
    async with async_session() as db:
        # Check if products already exist
        result = await db.execute(select(Product))
        existing = result.scalars().all()
        if existing:
            print(f"Already have {len(existing)} products. Deleting...")
            for p in existing:
                await db.delete(p)
            await db.commit()

        for p in PRODUCTS:
            product = Product(**p, is_active=True)
            db.add(product)
            print(f"  + {p['name']} — {p['price']}₽ / {p['credits']} кредитов")

        await db.commit()
        print(f"\n✅ Added {len(PRODUCTS)} products!")


if __name__ == "__main__":
    asyncio.run(seed())