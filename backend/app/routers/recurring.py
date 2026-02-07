"""Recurring transactions (bills & subscriptions) management."""
from datetime import date, timedelta
from typing import Optional, List
from dateutil.relativedelta import relativedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from ..database import get_db
from ..models import RecurringTransaction, Profile, Category
from ..dependencies import get_current_active_user

router = APIRouter(tags=["Recurring Transactions"])


# ============================================================================
# Schemas
# ============================================================================

class RecurringCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    amount: float
    frequency: str = Field(..., description="monthly, weekly, biweekly, quarterly, yearly")
    day_of_month: Optional[int] = Field(None, ge=1, le=31)
    day_of_week: Optional[int] = Field(None, ge=0, le=6)
    start_date: date
    end_date: Optional[date] = None
    category_id: Optional[int] = None
    is_income: bool = False
    notes: Optional[str] = None

class RecurringUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = None
    frequency: Optional[str] = None
    day_of_month: Optional[int] = None
    day_of_week: Optional[int] = None
    end_date: Optional[date] = None
    category_id: Optional[int] = None
    is_income: Optional[bool] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None

class RecurringResponse(BaseModel):
    id: int
    name: str
    amount: float
    frequency: str
    day_of_month: Optional[int]
    day_of_week: Optional[int]
    start_date: date
    end_date: Optional[date]
    next_due_date: date
    category_id: Optional[int]
    category_name: Optional[str] = None
    is_income: bool
    is_active: bool
    notes: Optional[str]

    class Config:
        from_attributes = True


# ============================================================================
# Helpers
# ============================================================================

def calculate_next_due(frequency: str, start_date: date, day_of_month: Optional[int] = None) -> date:
    """Calculate the next due date from today based on frequency."""
    today = date.today()
    next_date = start_date

    if frequency == "monthly":
        while next_date <= today:
            next_date += relativedelta(months=1)
        if day_of_month:
            try:
                next_date = next_date.replace(day=min(day_of_month, 28))
            except ValueError:
                pass
    elif frequency == "weekly":
        while next_date <= today:
            next_date += timedelta(weeks=1)
    elif frequency == "biweekly":
        while next_date <= today:
            next_date += timedelta(weeks=2)
    elif frequency == "quarterly":
        while next_date <= today:
            next_date += relativedelta(months=3)
    elif frequency == "yearly":
        while next_date <= today:
            next_date += relativedelta(years=1)

    return next_date


def get_user_profile(db: Session, user) -> Profile:
    """Get the primary profile for the current user."""
    profile = db.query(Profile).filter(
        Profile.user_id == user.id,
        Profile.is_primary == True
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="No primary profile found")
    return profile


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/", response_model=List[RecurringResponse])
async def list_recurring(
    active_only: bool = True,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all recurring transactions for the user."""
    profile = get_user_profile(db, current_user)

    query = db.query(RecurringTransaction).filter(
        RecurringTransaction.profile_id == profile.id
    )
    if active_only:
        query = query.filter(RecurringTransaction.is_active == True)

    items = query.order_by(RecurringTransaction.next_due_date).all()

    result = []
    for item in items:
        cat_name = None
        if item.category_id:
            cat = db.query(Category).filter(Category.id == item.category_id).first()
            cat_name = cat.name if cat else None
        result.append(RecurringResponse(
            id=item.id,
            name=item.name,
            amount=float(item.amount),
            frequency=item.frequency,
            day_of_month=item.day_of_month,
            day_of_week=item.day_of_week,
            start_date=item.start_date,
            end_date=item.end_date,
            next_due_date=item.next_due_date,
            category_id=item.category_id,
            category_name=cat_name,
            is_income=item.is_income,
            is_active=item.is_active,
            notes=item.notes,
        ))
    return result


@router.post("/", response_model=RecurringResponse, status_code=status.HTTP_201_CREATED)
async def create_recurring(
    data: RecurringCreate,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new recurring transaction."""
    profile = get_user_profile(db, current_user)

    if data.frequency not in ("monthly", "weekly", "biweekly", "quarterly", "yearly"):
        raise HTTPException(status_code=400, detail="Invalid frequency")

    next_due = calculate_next_due(data.frequency, data.start_date, data.day_of_month)

    item = RecurringTransaction(
        profile_id=profile.id,
        category_id=data.category_id,
        name=data.name,
        amount=data.amount,
        frequency=data.frequency,
        day_of_month=data.day_of_month,
        day_of_week=data.day_of_week,
        start_date=data.start_date,
        end_date=data.end_date,
        next_due_date=next_due,
        is_income=data.is_income,
        notes=data.notes,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    cat_name = None
    if item.category_id:
        cat = db.query(Category).filter(Category.id == item.category_id).first()
        cat_name = cat.name if cat else None

    return RecurringResponse(
        id=item.id,
        name=item.name,
        amount=float(item.amount),
        frequency=item.frequency,
        day_of_month=item.day_of_month,
        day_of_week=item.day_of_week,
        start_date=item.start_date,
        end_date=item.end_date,
        next_due_date=item.next_due_date,
        category_id=item.category_id,
        category_name=cat_name,
        is_income=item.is_income,
        is_active=item.is_active,
        notes=item.notes,
    )


@router.put("/{recurring_id}", response_model=RecurringResponse)
async def update_recurring(
    recurring_id: int,
    data: RecurringUpdate,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a recurring transaction."""
    profile = get_user_profile(db, current_user)

    item = db.query(RecurringTransaction).filter(
        RecurringTransaction.id == recurring_id,
        RecurringTransaction.profile_id == profile.id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Recurring transaction not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)

    # Recalculate next due date if frequency changed
    if "frequency" in update_data or "day_of_month" in update_data:
        item.next_due_date = calculate_next_due(
            item.frequency, item.start_date, item.day_of_month
        )

    db.commit()
    db.refresh(item)

    cat_name = None
    if item.category_id:
        cat = db.query(Category).filter(Category.id == item.category_id).first()
        cat_name = cat.name if cat else None

    return RecurringResponse(
        id=item.id,
        name=item.name,
        amount=float(item.amount),
        frequency=item.frequency,
        day_of_month=item.day_of_month,
        day_of_week=item.day_of_week,
        start_date=item.start_date,
        end_date=item.end_date,
        next_due_date=item.next_due_date,
        category_id=item.category_id,
        category_name=cat_name,
        is_income=item.is_income,
        is_active=item.is_active,
        notes=item.notes,
    )


@router.delete("/{recurring_id}", response_model=dict)
async def delete_recurring(
    recurring_id: int,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a recurring transaction."""
    profile = get_user_profile(db, current_user)

    item = db.query(RecurringTransaction).filter(
        RecurringTransaction.id == recurring_id,
        RecurringTransaction.profile_id == profile.id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Recurring transaction not found")

    db.delete(item)
    db.commit()
    return {"message": "Recurring transaction deleted"}


@router.get("/upcoming", response_model=List[RecurringResponse])
async def upcoming_bills(
    days: int = 30,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get bills due within the next N days."""
    profile = get_user_profile(db, current_user)
    cutoff = date.today() + timedelta(days=days)

    items = db.query(RecurringTransaction).filter(
        RecurringTransaction.profile_id == profile.id,
        RecurringTransaction.is_active == True,
        RecurringTransaction.next_due_date <= cutoff
    ).order_by(RecurringTransaction.next_due_date).all()

    result = []
    for item in items:
        cat_name = None
        if item.category_id:
            cat = db.query(Category).filter(Category.id == item.category_id).first()
            cat_name = cat.name if cat else None
        result.append(RecurringResponse(
            id=item.id,
            name=item.name,
            amount=float(item.amount),
            frequency=item.frequency,
            day_of_month=item.day_of_month,
            day_of_week=item.day_of_week,
            start_date=item.start_date,
            end_date=item.end_date,
            next_due_date=item.next_due_date,
            category_id=item.category_id,
            category_name=cat_name,
            is_income=item.is_income,
            is_active=item.is_active,
            notes=item.notes,
        ))
    return result
