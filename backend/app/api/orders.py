from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.order import Order, OrderStatus
from app.models.product import Product
from app.models.user import User
from app.schemas.order import OrderCreate, OrderRead, OrderReject, QRPaymentInfo
from app.api.deps import get_current_user, require_admin
from app.services.order_service import (
    create_order,
    mark_paid,
    confirm_order,
    reject_order,
    cancel_order,
)
from app.services.credit_service import grant_credits
from app.services.notification_service import get_admin_telegram_ids
from app.bot import notifications as bot
from app.config import settings

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("/", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
async def create_new_order(
    body: OrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new order for a product."""
    product = await db.get(Product, body.product_id)
    if not product or not product.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    try:
        order = await create_order(db, current_user, product)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return order


@router.get("/my", response_model=list[OrderRead])
async def my_orders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current user's orders."""
    result = await db.execute(
        select(Order)
        .where(Order.user_id == current_user.id)
        .order_by(Order.created_at.desc())
    )
    return result.scalars().all()


@router.get("/my/active", response_model=OrderRead)
async def my_active_order(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current user's active order (pending or awaiting_confirmation)."""
    result = await db.execute(
        select(Order).where(
            Order.user_id == current_user.id,
            or_(
                Order.status == OrderStatus.pending,
                Order.status == OrderStatus.awaiting_confirmation,
            ),
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active order",
        )
    return order


@router.get("/my/active/qr", response_model=QRPaymentInfo)
async def get_payment_qr(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get QR payment info for active order."""
    result = await db.execute(
        select(Order).where(
            Order.user_id == current_user.id,
            Order.status == OrderStatus.pending,
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No pending order",
        )

    return QRPaymentInfo(
        order_id=order.id,
        amount=float(order.amount),
        payment_comment=order.payment_comment,
        qr_image_url=settings.QR_SBP_IMAGE_URL,
        qr_sbp_link=settings.QR_SBP_LINK,
        recipient_name=settings.QR_SBP_RECIPIENT_NAME,
        bank_name=settings.QR_SBP_BANK_NAME,
    )


@router.post("/{order_id}/mark-paid", response_model=OrderRead)
async def mark_order_paid(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Player marks their order as paid."""
    order = await db.get(Order, order_id)
    if not order or order.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    try:
        order = await mark_paid(db, order)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Notify admins
    product = await db.get(Product, order.product_id)
    admin_ids = await get_admin_telegram_ids(db)
    await bot.notify_admins_new_order(
        admin_telegram_ids=admin_ids,
        player_name=f"{current_user.first_name} {current_user.last_name or ''}".strip(),
        player_username=current_user.username,
        product_name=product.name if product else "Неизвестный товар",
        amount=float(order.amount),
        order_id=order.id,
    )

    return order


@router.post("/{order_id}/cancel", response_model=OrderRead)
async def cancel_my_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Player cancels their pending order."""
    order = await db.get(Order, order_id)
    if not order or order.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    try:
        order = await cancel_order(db, order)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return order


# ── Admin endpoints ──────────────────────────────────────────────


@router.get("/pending", response_model=list[OrderRead])
async def list_pending_orders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """List orders awaiting confirmation. Admin only."""
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.user))
        .where(Order.status == OrderStatus.awaiting_confirmation)
        .order_by(Order.paid_at.asc())
    )
    return result.scalars().all()


@router.get("/all", response_model=list[OrderRead])
async def list_all_orders(
    status_filter: OrderStatus | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """List all orders with optional status filter. Admin only."""
    query = select(Order).options(selectinload(Order.user)).order_by(Order.created_at.desc())
    if status_filter:
        query = query.where(Order.status == status_filter)

    result = await db.execute(query)
    return result.scalars().all()


@router.post("/{order_id}/confirm", response_model=OrderRead)
async def confirm_order_payment(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Admin confirms order payment and grants credits."""
    order = await db.get(Order, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    try:
        order = await confirm_order(db, order)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Grant credits (idempotent)
    await grant_credits(db, order)

    # Notify player
    product = await db.get(Product, order.product_id)
    user = await db.get(User, order.user_id)
    if user:
        await bot.notify_order_confirmed(
            user.telegram_id,
            product.name if product else "Товар",
            order.credits_count,
        )

    return order


@router.post("/{order_id}/reject", response_model=OrderRead)
async def reject_order_payment(
    order_id: int,
    body: OrderReject,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Admin rejects order payment."""
    order = await db.get(Order, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )

    try:
        order = await reject_order(db, order, body.reason)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Notify player
    product = await db.get(Product, order.product_id)
    user = await db.get(User, order.user_id)
    if user:
        await bot.notify_order_rejected(
            user.telegram_id,
            product.name if product else "Товар",
            body.reason,
        )

    return order