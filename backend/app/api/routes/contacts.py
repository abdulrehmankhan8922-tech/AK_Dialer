from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.schemas.contact import ContactResponse, ContactUpdate, ContactCreate
from app.models.contact import Contact
from app.api.deps import get_current_agent_id

router = APIRouter(prefix="/api/contacts", tags=["contacts"])


@router.get("/", response_model=list[ContactResponse])
async def list_contacts(
    campaign_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    agent_id: int = Depends(get_current_agent_id)
):
    """List all contacts, optionally filtered by campaign. Admins see all contacts. Non-admin agents see contacts from their active campaign."""
    from app.models.agent import Agent, AgentSession
    
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    is_admin = agent and agent.is_admin == 1
    
    query = db.query(Contact)
    
    # If not admin, show contacts from agent's active campaign
    if not is_admin:
        # Get agent's current session to find their campaign
        session = db.query(AgentSession).filter(
            AgentSession.agent_id == agent_id,
            AgentSession.logout_time.is_(None)
        ).order_by(AgentSession.login_time.desc()).first()
        
        if session and session.campaign_id:
            # Filter contacts by agent's campaign
            query = query.filter(Contact.campaign_id == session.campaign_id)
        else:
            # No active campaign session, return empty for non-admins
            return []
    
    # Apply campaign filter if provided (for admin filtering or further filtering)
    if campaign_id:
        query = query.filter(Contact.campaign_id == campaign_id)
    
    contacts = query.order_by(Contact.created_at.desc()).all()
    return [ContactResponse.model_validate(contact) for contact in contacts]


@router.post("/", response_model=ContactResponse)
async def create_contact(contact: ContactCreate, db: Session = Depends(get_db)):
    """Create a new contact"""
    db_contact = Contact(**contact.dict())
    db.add(db_contact)
    db.commit()
    db.refresh(db_contact)
    return ContactResponse.model_validate(db_contact)


@router.put("/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: int,
    contact_update: ContactUpdate,
    db: Session = Depends(get_db),
    agent_id: int = Depends(get_current_agent_id)
):
    """Update contact information"""
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    update_data = contact_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(contact, field, value)
    
    db.commit()
    db.refresh(contact)
    return ContactResponse.from_orm(contact)


@router.get("/{contact_id}", response_model=ContactResponse)
async def get_contact(contact_id: int, db: Session = Depends(get_db)):
    """Get contact by ID"""
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return ContactResponse.from_orm(contact)
