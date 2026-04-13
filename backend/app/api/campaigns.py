from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, and_, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.models.campaign import (
    Campaign, CampaignMember, CampaignStatus, CampaignVisibility, CampaignMemberStatus, CampaignFunding,
)
from app.schemas.campaign import (
    CampaignCreate, CampaignUpdate, CampaignRead, CampaignMemberRead,
)
from app.api.deps import get_current_user, require_gm
from app.services.signup_service import cancel_future_signups_for_campaign, auto_signup_new_member
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
        .where(CampaignMember.status == CampaignMemberStatus.active)
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
            funding=camp.funding,
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


@router.get("/joined", response_model=list[CampaignRead])
async def list_joined_campaigns(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List campaigns the current user has joined as a member."""
    result = await db.execute(
        select(CampaignMember.campaign_id)
        .where(
            and_(
                CampaignMember.user_id == current_user.id,
                CampaignMember.status == CampaignMemberStatus.active,
            )
        )
    )
    campaign_ids = [row[0] for row in result.all()]
    if not campaign_ids:
        return []
    return await campaigns_with_counts(db, Campaign.id.in_(campaign_ids))


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
    funding = (
        CampaignFunding.private
        if current_user.role == UserRole.private_gm
        else CampaignFunding.club
    )
    campaign = Campaign(
        type=body.type,
        title=body.title,
        system=body.system,
        description=body.description,
        owner_gm_user_id=current_user.id,
        visibility=body.visibility,
        funding=funding,
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)

    return CampaignRead(
        id=campaign.id,
        type=campaign.type,
        funding=campaign.funding,
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
        select(CampaignMember, User)
        .join(User, CampaignMember.user_id == User.id)
        .where(CampaignMember.campaign_id == campaign_id)
        .order_by(CampaignMember.joined_at.asc())
    )
    rows = result.all()
    members = []
    for member, user in rows:
        members.append(CampaignMemberRead(
            id=member.id,
            campaign_id=member.campaign_id,
            user_id=member.user_id,
            status=member.status,
            joined_at=member.joined_at,
            first_name=user.first_name,
            last_name=user.last_name,
            username=user.username,
        ))
    return members


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
        status=CampaignMemberStatus.pending,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)

    gm = await db.get(User, campaign.owner_gm_user_id)
    if gm:
        player_name = f"{current_user.first_name} {current_user.last_name or ''}".strip()
        await notify.notify_new_application(
            gm.telegram_id, player_name, campaign.title
        )

    return CampaignMemberRead(
        id=member.id,
        campaign_id=member.campaign_id,
        user_id=member.user_id,
        status=member.status,
        joined_at=member.joined_at,
    )


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


@router.post("/{campaign_id}/members/{member_id}/approve", response_model=CampaignMemberRead)
async def approve_member(
    campaign_id: int,
    member_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_gm),
):
    """Approve a pending membership application. Owner GM or Admin only."""
    campaign = await db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    if campaign.owner_gm_user_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your campaign")

    result = await db.execute(
        select(CampaignMember).where(
            and_(CampaignMember.id == member_id, CampaignMember.campaign_id == campaign_id)
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    if member.status != CampaignMemberStatus.pending:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Application is not pending")

    member.status = CampaignMemberStatus.active
    await db.commit()
    await db.refresh(member)

    await auto_signup_new_member(db, member.user_id, campaign_id)

    player = await db.get(User, member.user_id)
    if player:
        await notify.notify_application_approved(player.telegram_id, campaign.title)

    result_user = await db.execute(select(User).where(User.id == member.user_id))
    user = result_user.scalar_one_or_none()
    return CampaignMemberRead(
        id=member.id,
        campaign_id=member.campaign_id,
        user_id=member.user_id,
        status=member.status,
        joined_at=member.joined_at,
        first_name=user.first_name if user else None,
        last_name=user.last_name if user else None,
        username=user.username if user else None,
    )


@router.post("/{campaign_id}/members/{member_id}/reject")
async def reject_member(
    campaign_id: int,
    member_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_gm),
):
    """Reject and remove a pending membership application. Owner GM or Admin only."""
    campaign = await db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    if campaign.owner_gm_user_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your campaign")

    result = await db.execute(
        select(CampaignMember).where(
            and_(CampaignMember.id == member_id, CampaignMember.campaign_id == campaign_id)
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    player_user_id = member.user_id
    await db.delete(member)
    await db.commit()

    player = await db.get(User, player_user_id)
    if player:
        await notify.notify_application_rejected(player.telegram_id, campaign.title)

    return {"detail": "Application rejected"}