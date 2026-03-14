from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.campaign import CampaignList, CampaignResponse, CampaignCreate
from app.models.campaign import Campaign, CampaignStatus, DialMethod
from app.api.deps import get_current_agent_id

router = APIRouter(prefix="/api/campaigns", tags=["campaigns"])


@router.get("/", response_model=CampaignList)
async def list_campaigns(db: Session = Depends(get_db)):
    """List all active campaigns"""
    campaigns = db.query(Campaign).filter(Campaign.status == CampaignStatus.ACTIVE).all()
    return {"campaigns": [CampaignResponse.model_validate(c) for c in campaigns]}


@router.post("/", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    campaign_data: CampaignCreate,
    db: Session = Depends(get_db),
    agent_id: int = Depends(get_current_agent_id)
):
    """Create a new campaign (any authenticated agent can create campaigns)"""
    # Check if campaign code already exists
    existing_campaign = db.query(Campaign).filter(Campaign.code == campaign_data.code).first()
    if existing_campaign:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Campaign with code '{campaign_data.code}' already exists"
        )
    
    # Create new campaign
    new_campaign = Campaign(
        name=campaign_data.name,
        code=campaign_data.code,
        description=campaign_data.description,
        status=campaign_data.status,
        dial_method=campaign_data.dial_method
    )
    
    db.add(new_campaign)
    db.commit()
    db.refresh(new_campaign)
    
    return CampaignResponse.model_validate(new_campaign)


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(campaign_id: int, db: Session = Depends(get_db)):
    """Get campaign by ID"""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return CampaignResponse.model_validate(campaign)
