"""Subscriptions router - detect and manage recurring subscriptions."""
import logging
from typing import List, Literal, Optional
from datetime import datetime, date

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from ..database import get_db
from ..models import Subscription, Transaction, Account, User
from ..dependencies import get_current_active_user
from ..services.subscription_detector import detect_subscriptions
from ..services import audit

logger = logging.getLogger(__name__)
router = APIRouter()


# Schemas
class SubscriptionCreate(BaseModel):
    profile_id: int
    name: str
    merchant_name: Optional[str] = None
    amount: float
    frequency: Literal["weekly", "biweekly", "monthly", "quarterly", "yearly"] = "monthly"
    category_id: Optional[int] = None
    notes: Optional[str] = None


class SubscriptionUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = None
    frequency: Optional[str] = None
    category_id: Optional[int] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class SubscriptionResponse(BaseModel):
    id: int
    profile_id: int
    name: str
    merchant_name: Optional[str]
    amount: float
    frequency: str
    category_id: Optional[int]
    last_charged: Optional[date]
    next_expected: Optional[date]
    is_active: bool
    is_flagged_unused: bool
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class SubscriptionSummary(BaseModel):
    total_monthly_cost: float
    total_annual_cost: float
    active_count: int
    flagged_unused_count: int


FREQ_MONTHLY_MULTIPLIER = {
    "weekly": 4.33,
    "biweekly": 2.17,
    "monthly": 1.0,
    "quarterly": 1 / 3,
    "yearly": 1 / 12,
}


@router.get("/", response_model=List[SubscriptionResponse])
def list_subscriptions(
    profile_id: Optional[int] = None,
    active_only: bool = True,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """List subscriptions."""
    profile_ids = [p.id for p in current_user.profiles]
    query = db.query(Subscription)

    if profile_id:
        if profile_id not in profile_ids:
            raise HTTPException(status_code=403, detail="Access denied to this profile")
        query = query.filter(Subscription.profile_id == profile_id)
    else:
        query = query.filter(Subscription.profile_id.in_(profile_ids))

    if active_only:
        query = query.filter(Subscription.is_active == True)

    return query.order_by(Subscription.name).all()


@router.get("/summary", response_model=SubscriptionSummary)
def get_subscription_summary(
    profile_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get subscription cost summary."""
    profile_ids = [p.id for p in current_user.profiles]
    query = db.query(Subscription).filter(
        Subscription.is_active == True,
    )
    if profile_id:
        if profile_id not in profile_ids:
            raise HTTPException(status_code=403, detail="Access denied to this profile")
        query = query.filter(Subscription.profile_id == profile_id)
    else:
        query = query.filter(Subscription.profile_id.in_(profile_ids))

    subs = query.all()

    total_monthly = 0.0
    flagged = 0
    for sub in subs:
        mult = FREQ_MONTHLY_MULTIPLIER.get(sub.frequency, 1.0)
        total_monthly += float(sub.amount) * mult
        if sub.is_flagged_unused:
            flagged += 1

    return SubscriptionSummary(
        total_monthly_cost=round(total_monthly, 2),
        total_annual_cost=round(total_monthly * 12, 2),
        active_count=len(subs),
        flagged_unused_count=flagged,
    )


@router.post("/", response_model=SubscriptionResponse)
def create_subscription(
    data: SubscriptionCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Manually add a subscription."""
    profile_ids = [p.id for p in current_user.profiles]
    if data.profile_id not in profile_ids:
        raise HTTPException(status_code=403, detail="Access denied to this profile")

    sub = Subscription(
        profile_id=data.profile_id,
        name=data.name,
        merchant_name=data.merchant_name,
        amount=data.amount,
        frequency=data.frequency,
        category_id=data.category_id,
        notes=data.notes,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


@router.put("/{subscription_id}", response_model=SubscriptionResponse)
def update_subscription(
    subscription_id: int,
    data: SubscriptionUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Update a subscription."""
    profile_ids = [p.id for p in current_user.profiles]
    sub = db.query(Subscription).filter(
        Subscription.id == subscription_id,
        Subscription.profile_id.in_(profile_ids),
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    for field in ("name", "amount", "frequency", "category_id", "is_active", "notes"):
        val = getattr(data, field, None)
        if val is not None:
            setattr(sub, field, val)

    db.commit()
    db.refresh(sub)
    return sub


@router.delete("/{subscription_id}")
def delete_subscription(
    subscription_id: int,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Delete a subscription."""
    profile_ids = [p.id for p in current_user.profiles]
    sub = db.query(Subscription).filter(
        Subscription.id == subscription_id,
        Subscription.profile_id.in_(profile_ids),
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    db.delete(sub)
    db.commit()
    audit.log_from_request(db, request, audit.RESOURCE_DELETED, user_id=current_user.id, resource_type="subscription", resource_id=str(subscription_id))
    return {"message": "Subscription deleted"}


@router.post("/detect")
def detect_subscription_patterns(
    profile_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Scan transactions for recurring subscription patterns."""
    profile_ids = [p.id for p in current_user.profiles]
    if profile_id not in profile_ids:
        raise HTTPException(status_code=403, detail="Access denied to this profile")

    detected = detect_subscriptions(db, profile_id)
    return {"detected": len(detected), "subscriptions": detected}
