from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, and_, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.models.campaign import (
    Campaign, CampaignMember, CampaignStatus, CampaignVisibility,
)
from app.schemas.campaign import (
    CampaignCreate, CampaignUpdate, CampaignRead, CampaignMemberRead,
)
from app.api.deps import get_current_user, require_gm
from app.services.signup_service import cancel_future_signups_for_campaign
from app.bot import notifications as notify

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


async def campaigns_with_counts(
    db: AsyncSession, where_clause=None
) -> list[CampaignRead]:
    """Load campaigns with member_count via subquery (no lazy loading)."""
    member_count_sub = (
        select(
            CampaignMember.campaign_id,
            sa_func.count().label("cnt"),
        )
        .group_by(CampaignMember.campaign_id)
        .subquery()
    )

    query = (
        select(Campaign, sa_func.coalesce(member_count_sub.c.cnt, 0))
        .outerjoin(
            member_count_sub,
            Campaign.id == member_count_sub.c.campaign_id,
        )
    )

    if where_clause is not None:
        query = query.where(where_clause)

    query = query.order_by(Campaign.created_at.desc())

    result = await db.execute(query)
    rows = result.all()

    return [
        CampaignRead(
            id=camp.id,
            type=camp.type,
            title=camp.title,
            system=camp.system,
            description=camp.description,
            owner_gm_user_id=camp.owner_gm_user_id,
            visibility=camp.visibility,
            status=camp.status,
            member_count=cnt,
            created_at=camp.created_at,
        )
        for camp, cnt in rows
    ]


# ── Public ───────────────────────────────────────────────────────


@router.get("/", response_model=list[CampaignRead])
async def list_campaigns(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all public active campaigns."""
    return await campaigns_with_counts(
        db,
        and_(
            Campaign.visibility == CampaignVisibility.public,
            Campaign.status == CampaignStatus.active,
        ),
    )


@router.get("/my", response_model=list[CampaignRead])
async def my_campaigns(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_gm),
):
    """List campaigns owned by current GM."""
    return await campaigns_with_counts(
        db,
        Campaign.owner_gm_user_id == current_user.id,
    )


@router.get("/{campaign_id}", response_model=CampaignRead)
async def get_campaign(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get campaign by ID."""
    results = await campaigns_with_counts(
        db, Campaign.id == campaign_id
    )
    if not results:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found",
        )
    return results[0]


# ── GM ───────────────────────────────────────────────────────────


@router.post("/", response_model=CampaignRead, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    body: CampaignCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_gm),
):
    """Create a new campaign. GM only."""
    campaign = Campaign(
        type=body.type,
        title=body.title,
        system=body.system,
        description=body.description,
        owner_gm_user_id=current_user.id,
        visibility=body.visibility,
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)

    return CampaignRead(
        id=campaign.id,
        type=campaign.type,
        title=campaign.title,
        system=campaign.system,
        description=campaign.description,
        owner_gm_user_id=campaign.owner_gm_user_id,
        visibility=campaign.visibility,
        status=campaign.status,
        member_count=0,
        created_at=campaign.created_at,
    )


@router.patch("/{campaign_id}", response_model=CampaignRead)
async def update_campaign(
    campaign_id: int,
    body: CampaignUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_gm),
):
    """Update campaign. Owner GM or Admin."""
    campaign = await db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found",
        )

    if (
        campaign.owner_gm_user_id != current_user.id
        and current_user.role != UserRole.admin
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not your campaign",
        )

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(campaign, field, value)

    await db.commit()

    results = await campaigns_with_counts(db, Campaign.id == campaign_id)
    return results[0]


# ── Members ──────────────────────────────────────────────────────


@router.get("/{campaign_id}/members", response_model=list[CampaignMemberRead])
async def list_members(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List campaign members."""
    campaign = await db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found",
        )

    result = await db.execute(
        select(CampaignMember)
        .where(CampaignMember.campaign_id == campaign_id)
        .order_by(CampaignMember.joined_at.asc())
    )
    return result.scalars().all()


@router.post("/{campaign_id}/join", response_model=CampaignMemberRead)
async def join_campaign(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Join a campaign."""
    campaign = await db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found",
        )

    if campaign.status != CampaignStatus.active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Campaign is not active",
        )

    result = await db.execute(
        select(CampaignMember).where(
            and_(
                CampaignMember.campaign_id == campaign_id,
                CampaignMember.user_id == current_user.id,
            )
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already a member",
        )

    member = CampaignMember(
        campaign_id=campaign_id,
        user_id=current_user.id,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)

    gm = await db.get(User, campaign.owner_gm_user_id)
    if gm:
        player_name = f"{current_user.first_name} {current_user.last_name or ''}".strip()
        await notify.notify_new_member(
            gm.telegram_id, player_name, campaign.title
        )

    return member


@router.post("/{campaign_id}/leave")
async def leave_campaign(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Leave a campaign. Cancels all future signups."""
    result = await db.execute(
        select(CampaignMember).where(
            and_(
                CampaignMember.campaign_id == campaign_id,
                CampaignMember.user_id == current_user.id,
            )
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not a member",
        )

    await cancel_future_signups_for_campaign(
        db, current_user.id, campaign_id
    )

    await db.delete(member)
    await db.commit()

    return {"detail": "Left campaign successfully"}