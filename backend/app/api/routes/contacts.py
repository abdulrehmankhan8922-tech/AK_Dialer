from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional, List
import pandas as pd
import io
from app.core.database import get_db
from app.schemas.contact import ContactResponse, ContactUpdate, ContactCreate
from app.models.contact import Contact, ContactStatus, GenderType
from app.api.deps import get_current_agent_id

router = APIRouter(prefix="/api/contacts", tags=["contacts"])


@router.get("/", response_model=list[ContactResponse])
async def list_contacts(
    campaign_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    agent_id: int = Depends(get_current_agent_id)
):
    """List all contacts, optionally filtered by campaign. All agents see all contacts (or filtered by campaign if specified)."""
    from app.models.agent import Agent
    
    query = db.query(Contact)
    
    # Apply campaign filter if provided
    # If no campaign_id is specified, show all contacts to all agents
    if campaign_id:
        query = query.filter(Contact.campaign_id == campaign_id)
    
    # All agents can see all contacts (no restriction based on agent's campaign)
    # This allows all agents to access all imported contacts
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


@router.post("/import", response_model=dict)
async def import_contacts(
    file: UploadFile = File(...),
    campaign_id: int = Query(..., description="Campaign ID to import contacts into"),
    db: Session = Depends(get_db),
    agent_id: int = Depends(get_current_agent_id)
):
    """
    Import contacts from Excel file (.xlsx, .xls)
    
    Required column: Phone (supports: phone, businessphone, phonenumber, mobile, cell, tel, telephone)
    
    Optional columns (flexible naming):
    - Name: name, businessname, contactname, fullname, companyname
    - Address: address, businessaddress, businessaddres, location
    - City: city, town
    - Occupation: occupation, job, profession, title
    - Gender: gender, sex (M/F/U)
    - WhatsApp: whatsapp, wa, whatsappnumber
    - Email: email, e-mail, mail, emailaddress
    - Comments: comments, comment, notes, note, remarks
    """
    try:
        # Check if file is Excel
        if not file.filename.endswith(('.xlsx', '.xls')):
            raise HTTPException(status_code=400, detail="File must be Excel format (.xlsx or .xls)")
        
        # Read file content
        contents = await file.read()
        
        # Read Excel file
        try:
            df = pd.read_excel(io.BytesIO(contents))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error reading Excel file: {str(e)}")
        
        # Normalize column names (lowercase, strip spaces, remove special chars)
        df.columns = df.columns.str.lower().str.strip().str.replace(' ', '').str.replace('_', '')
        
        # Create column mapping for flexible column names
        def find_column(df_cols, possible_names):
            """Find column by trying multiple possible names"""
            for col in df_cols:
                col_clean = col.lower().strip().replace(' ', '').replace('_', '')
                for name in possible_names:
                    if col_clean == name.lower().replace(' ', '').replace('_', ''):
                        return col
            return None
        
        # Map columns with flexible matching
        phone_col = find_column(df.columns, ['phone', 'businessphone', 'phonenumber', 'mobile', 'cell', 'tel', 'telephone'])
        name_col = find_column(df.columns, ['name', 'businessname', 'contactname', 'fullname', 'companyname'])
        address_col = find_column(df.columns, ['address', 'businessaddress', 'businessaddres', 'businessadd', 'addres', 'location'])
        city_col = find_column(df.columns, ['city', 'town'])
        occupation_col = find_column(df.columns, ['occupation', 'job', 'profession', 'title'])
        gender_col = find_column(df.columns, ['gender', 'sex'])
        whatsapp_col = find_column(df.columns, ['whatsapp', 'wa', 'whatsappnumber'])
        email_col = find_column(df.columns, ['email', 'e-mail', 'mail', 'emailaddress'])
        comments_col = find_column(df.columns, ['comments', 'comment', 'notes', 'note', 'remarks'])
        
        # Validate required phone column
        if not phone_col:
            raise HTTPException(
                status_code=400, 
                detail="Excel file must contain a phone column. Supported names: phone, businessphone, phonenumber, mobile, cell, tel, telephone"
            )
        
        # Process rows
        imported = 0
        skipped = 0
        errors = []
        
        for index, row in df.iterrows():
            try:
                # Get phone (required)
                phone = str(row.get(phone_col, '')).strip() if pd.notna(row.get(phone_col)) else ''
                if not phone or phone == 'nan':
                    skipped += 1
                    errors.append(f"Row {index + 2}: Missing phone number")
                    continue
                
                # Check if contact already exists
                existing = db.query(Contact).filter(
                    Contact.phone == phone,
                    Contact.campaign_id == campaign_id
                ).first()
                
                if existing:
                    skipped += 1
                    errors.append(f"Row {index + 2}: Contact with phone {phone} already exists")
                    continue
                
                # Get optional fields using mapped columns
                name = str(row.get(name_col, '')).strip() if name_col and pd.notna(row.get(name_col)) else None
                address = str(row.get(address_col, '')).strip() if address_col and pd.notna(row.get(address_col)) else None
                city = str(row.get(city_col, '')).strip() if city_col and pd.notna(row.get(city_col)) else None
                occupation = str(row.get(occupation_col, '')).strip() if occupation_col and pd.notna(row.get(occupation_col)) else None
                whatsapp = str(row.get(whatsapp_col, '')).strip() if whatsapp_col and pd.notna(row.get(whatsapp_col)) else None
                email = str(row.get(email_col, '')).strip() if email_col and pd.notna(row.get(email_col)) else None
                comments = str(row.get(comments_col, '')).strip() if comments_col and pd.notna(row.get(comments_col)) else None
                
                # Handle gender
                gender_str = None
                if gender_col and pd.notna(row.get(gender_col)):
                    gender_str = str(row.get(gender_col, 'U')).strip().upper()
                else:
                    gender_str = 'U'
                
                # Determine gender enum value - use the enum object, SQLAlchemy will convert to value
                if gender_str in ['M', 'MALE']:
                    gender_value = GenderType.MALE
                elif gender_str in ['F', 'FEMALE']:
                    gender_value = GenderType.FEMALE
                else:
                    gender_value = GenderType.UNDEFINED
                
                # Create contact
                # Note: For native_enum=True, SQLAlchemy should use .value automatically
                # But if it doesn't, we'll pass the value directly as a workaround
                contact = Contact(
                    campaign_id=campaign_id,
                    name=name if name and name != 'nan' else None,
                    phone=phone,
                    address=address if address and address != 'nan' else None,
                    city=city if city and city != 'nan' else None,
                    occupation=occupation if occupation and occupation != 'nan' else None,
                    gender=gender_value,  # Pass enum object, SQLAlchemy should use .value automatically
                    whatsapp=whatsapp if whatsapp and whatsapp != 'nan' else None,
                    email=email if email and email != 'nan' else None,
                    comments=comments if comments and comments != 'nan' else None,
                    status=ContactStatus.NEW
                )
                
                db.add(contact)
                imported += 1
                
            except Exception as e:
                skipped += 1
                errors.append(f"Row {index + 2}: {str(e)}")
                continue
        
        # Commit all contacts
        db.commit()
        
        return {
            "success": True,
            "imported": imported,
            "skipped": skipped,
            "total_rows": len(df),
            "errors": errors[:50]  # Limit errors to first 50
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error importing contacts: {str(e)}")
