"""Profiles API router - manage household member profiles."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import date

from app.database import get_db
from app.models import Profile

router = APIRouter()


# Pydantic schemas
class ProfileCreate(BaseModel):
    name: str
    email: Optional[str] = None
    is_primary: bool = False
    service_start_date: Optional[date] = None
    base_pay: Optional[float] = None

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    is_primary: Optional[bool] = None
    service_start_date: Optional[date] = None
    base_pay: Optional[float] = None
    tsp_contribution_pct: Optional[float] = None
    tsp_roth_pct: Optional[float] = None

class ProfileResponse(BaseModel):
    id: int
    name: str
    email: Optional[str]
    is_primary: bool
    service_start_date: Optional[date]
    base_pay: Optional[float]
    tsp_contribution_pct: float
    tsp_roth_pct: float
    
    class Config:
        from_attributes = True


@router.get("/", response_model=List[ProfileResponse])
def get_profiles(db: Session = Depends(get_db)):
    """Get all household profiles."""
    return db.query(Profile).all()


@router.get("/{profile_id}", response_model=ProfileResponse)
def get_profile(profile_id: int, db: Session = Depends(get_db)):
    """Get a specific profile."""
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.post("/", response_model=ProfileResponse)
def create_profile(profile: ProfileCreate, db: Session = Depends(get_db)):
    """Create a new profile."""
    db_profile = Profile(
        name=profile.name,
        email=profile.email,
        is_primary=profile.is_primary,
        service_start_date=profile.service_start_date,
        base_pay=profile.base_pay
    )
    
    # If this is marked as primary, unmark others
    if profile.is_primary:
        db.query(Profile).update({Profile.is_primary: False})
    
    db.add(db_profile)
    db.commit()
    db.refresh(db_profile)
    return db_profile


@router.put("/{profile_id}", response_model=ProfileResponse)
def update_profile(profile_id: int, profile: ProfileUpdate, db: Session = Depends(get_db)):
    """Update a profile."""
    db_profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not db_profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    update_data = profile.model_dump(exclude_unset=True)
    
    # If setting as primary, unmark others
    if update_data.get("is_primary"):
        db.query(Profile).filter(Profile.id != profile_id).update({Profile.is_primary: False})
    
    for key, value in update_data.items():
        setattr(db_profile, key, value)
    
    db.commit()
    db.refresh(db_profile)
    return db_profile


@router.delete("/{profile_id}")
def delete_profile(profile_id: int, db: Session = Depends(get_db)):
    """Delete a profile."""
    db_profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not db_profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    db.delete(db_profile)
    db.commit()
    return {"status": "deleted"}
