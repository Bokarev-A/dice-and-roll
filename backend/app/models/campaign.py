import enum
from datetime import datetime

from sqlalchemy import (
    Integer, ForeignKey, String, Text, DateTime,
    Enum as SAEnum, func, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CampaignType(str, enum.Enum):
    campaign = "campaign"
    oneshot = "oneshot"


class CampaignFunding(str, enum.Enum):
    club = "club"        # От клуба: игроки платят кредитами, мастер получает gm_reward
    private = "private"  # Частная: мастер арендует комнату, с игроками сам


class CampaignVisibility(str, enum.Enum):
    public = "public"
    link = "link"


class CampaignStatus(str, enum.Enum):
    active = "active"
    archived = "archived"


class CampaignMemberStatus(str, enum.Enum):
    pending = "pending"
    active = "active"


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[CampaignType] = mapped_column(
        SAEnum(CampaignType), nullable=False
    )
    funding: Mapped[CampaignFunding] = mapped_column(
        SAEnum(CampaignFunding), default=CampaignFunding.club, nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    system: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_gm_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    visibility: Mapped[CampaignVisibility] = mapped_column(
        SAEnum(CampaignVisibility),
        default=CampaignVisibility.public,
        nullable=False,
    )
    status: Mapped[CampaignStatus] = mapped_column(
        SAEnum(CampaignStatus),
        default=CampaignStatus.active,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    owner = relationship("User", back_populates="owned_campaigns")
    members = relationship("CampaignMember", back_populates="campaign")
    sessions = relationship("GameSession", back_populates="campaign")


class CampaignMember(Base):
    __tablename__ = "campaign_members"

    id: Mapped[int] = mapped_column(primary_key=True)
    campaign_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("campaigns.id"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    status: Mapped[CampaignMemberStatus] = mapped_column(
        SAEnum(CampaignMemberStatus),
        default=CampaignMemberStatus.pending,
        server_default="pending",
        nullable=False,
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("campaign_id", "user_id", name="uq_campaign_member"),
    )

    # Relationships
    campaign = relationship("Campaign", back_populates="members")
    user = relationship("User", back_populates="memberships")
