from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.campaign import CampaignList, CampaignResponse
from app.models.campaign import Campaign, CampaignStatus

router = APIRouter(prefix="/api/campaigns", tags=["campaigns"])


@router.get("/", response_model=CampaignList)
async def list_campaigns(db: Session = Depends(get_db)):
    """List all active campaigns"""
    campaigns = db.query(Campaign).filter(Campaign.status == CampaignStatus.ACTIVE).all()
    return CampaignList(campaigns=[CampaignResponse.model_validate(c) for c in campaigns])


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(campaign_id: int, db: Session = Depends(get_db)):
    """Get campaign by ID"""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return CampaignResponse.model_validate(campaign)
