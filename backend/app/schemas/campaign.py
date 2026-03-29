from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.campaign import CampaignType, CampaignVisibility, CampaignStatus


class CampaignCreate(BaseModel):
    type: CampaignType
    title: str
    system: Optional[str] = None
    description: Optional[str] = None
    visibility: CampaignVisibility = CampaignVisibility.public


class CampaignUpdate(BaseModel):
    title: Optional[str] = None
    system: Optional[str] = None
    description: Optional[str] = None
    visibility: Optional[CampaignVisibility] = None
    status: Optional[CampaignStatus] = None


class CampaignRead(BaseModel):
    id: int
    type: CampaignType
    title: str
    system: Optional[str] = None
    description: Optional[str] = None
    owner_gm_user_id: int
    visibility: CampaignVisibility
    status: CampaignStatus
    member_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class CampaignMemberRead(BaseModel):
    id: int
    campaign_id: int
    user_id: int
    joined_at: datetime

    class Config:
        from_attributes = True