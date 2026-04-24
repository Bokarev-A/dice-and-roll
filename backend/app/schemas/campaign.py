from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.campaign import CampaignType, CampaignVisibility, CampaignStatus, CampaignMemberStatus, CampaignFunding


class CampaignCreate(BaseModel):
    type: CampaignType
    title: str
    system: Optional[str] = None
    description: Optional[str] = None
    visibility: CampaignVisibility = CampaignVisibility.public
    capacity: int = 5


class CampaignUpdate(BaseModel):
    title: Optional[str] = None
    system: Optional[str] = None
    description: Optional[str] = None
    visibility: Optional[CampaignVisibility] = None
    status: Optional[CampaignStatus] = None
    capacity: Optional[int] = None


class CampaignRead(BaseModel):
    id: int
    type: CampaignType
    funding: CampaignFunding
    title: str
    system: Optional[str] = None
    description: Optional[str] = None
    owner_gm_user_id: int
    visibility: CampaignVisibility
    status: CampaignStatus
    member_count: int = 0
    capacity: int = 5
    created_at: datetime
    next_session_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CampaignMemberRead(BaseModel):
    id: int
    campaign_id: int
    user_id: int
    status: CampaignMemberStatus
    joined_at: datetime
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None

    class Config:
        from_attributes = True