from datetime import datetime, timezone, timedelta

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import Order, OrderStatus
from app.models.product import Product
from app.models.user import User


async def create_order(
    db: AsyncSession, user: User, product: Product
) -> Order:
    """
    Create a new order for a user.
    Raises ValueError if user already has an active order.
    """
    # Check for existing active order
    result = await db.execute(
        select(Order).where(
            and_(
                Order.user_id == user.id,
                or_(
                    Order.status == OrderStatus.pending,
                    Order.status == OrderStatus.awaiting_confirmation,
                ),
            )
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise ValueError(
            "У вас уже есть активный заказ. "
            "Отмените его перед созданием нового."
        )

    order = Order(
        user_id=user.id,
        product_id=product.id,
        amount=float(product.price),
        credits_count=product.credits,
        duration_months=product.duration_months,
        status=OrderStatus.pending,
        payment_comment="",
    )
    db.add(order)
    await db.flush()

    # Set payment comment with order ID
    order.payment_comment = f"DnR #{order.id} {user.first_name}"

    await db.commit()
    await db.refresh(order)
    return order


async def mark_paid(db: AsyncSession, order: Order) -> Order:
    """Player marks order as paid."""
    if order.status != OrderStatus.pending:
        raise ValueError("Заказ не в статусе pending")

    order.status = OrderStatus.awaiting_confirmation
    order.paid_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(order)
    return order


async def confirm_order(db: AsyncSession, order: Order) -> Order:
    """Admin confirms order payment."""
    if order.status != OrderStatus.awaiting_confirmation:
        raise ValueError("Заказ не в статусе awaiting_confirmation")

    order.status = OrderStatus.confirmed
    order.confirmed_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(order)
    return order


async def reject_order(
    db: AsyncSession, order: Order, reason: str
) -> Order:
    """Admin rejects order."""
    if order.status != OrderStatus.awaiting_confirmation:
        raise ValueError("Заказ не в статусе awaiting_confirmation")

    order.status = OrderStatus.rejected
    order.reject_reason = reason

    await db.commit()
    await db.refresh(order)
    return order


async def cancel_order(db: AsyncSession, order: Order) -> Order:
    """Player cancels a pending order."""
    if order.status != OrderStatus.pending:
        raise ValueError("Можно отменить только заказ в статусе pending")

    order.status = OrderStatus.cancelled

    await db.commit()
    await db.refresh(order)
    return order


async def expire_orders(
    db: AsyncSession, expiry_hours: int
) -> list[Order]:
    """
    Expire orders that have been pending too long.
    Called by scheduler.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=expiry_hours)

    result = await db.execute(
        select(Order).where(
            and_(
                Order.status == OrderStatus.pending,
                Order.created_at <= cutoff,
            )
        )
    )
    orders = list(result.scalars().all())

    for order in orders:
        order.status = OrderStatus.expired

    if orders:
        await db.commit()

    return orders