from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.product import Product
from app.models.user import UserRole
from app.schemas.product import ProductRead, ProductCreate
from app.api.deps import get_current_user, require_admin

router = APIRouter(prefix="/products", tags=["products"])


@router.get("/", response_model=list[ProductRead])
async def list_products(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List all active products."""
    result = await db.execute(
        select(Product)
        .where(Product.is_active == True)  # noqa: E712
        .order_by(Product.category.asc(), Product.credits.asc())
    )
    return result.scalars().all()


@router.post("/", response_model=ProductRead)
async def create_product(
    data: ProductCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    """Create a new product (admin only)."""
    product = Product(
        name=data.name,
        price=data.price,
        credits=data.credits,
        duration_months=data.duration_months,
        category=data.category,
        is_active=True,
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product