"""Unified spending control router - budgets, envelopes, and savings rules."""
from datetime import datetime, date
from typing import Optional, List
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import and_
from pydantic import BaseModel, Field

from ..database import get_db
from ..models import SpendingControl, User, Profile, Category, SavingsGoal
from ..dependencies import get_current_active_user
from ..services import audit
from ..services.spending_control import SpendingControlService

router = APIRouter(tags=["Spending Controls"])

VALID_METHODOLOGIES = {"budget", "envelope", "savings_rule"}
VALID_PERIODS = {"monthly", "weekly", "one_time"}
VALID_RULE_TYPES = {"round_up", "percentage", "fixed_schedule"}


# ============================================================================
# Schemas
# ============================================================================

class SpendingControlCreate(BaseModel):
    """Schema for creating a new spending control."""
    profile_id: int
    name: str = Field(..., min_length=1, max_length=100)
    methodology: str = Field(..., pattern="^(budget|envelope|savings_rule)$")

    # Common fields
    category_id: Optional[int] = None
    amount: float = Field(..., ge=0)
    period: str = Field(default="monthly", pattern="^(monthly|weekly|one_time)$")
    is_active: bool = True

    # Budget-specific
    month: Optional[date] = None
    is_template: bool = False
    rollover_amount: float = 0
    alert_threshold_pct: int = Field(default=80, ge=0, le=100)

    # Envelope-specific
    color: str = Field(default="#3b82f6", pattern="^#[0-9A-Fa-f]{6}$")
    icon: str = Field(default="wallet", max_length=50)

    # Savings Rule-specific
    goal_id: Optional[int] = None
    rule_type: Optional[str] = Field(None, pattern="^(round_up|percentage|fixed_schedule)$")
    round_up_to: Optional[int] = Field(None, ge=1, le=100)
    percentage: Optional[float] = Field(None, ge=0, le=100)
    frequency: Optional[str] = Field(None, pattern="^(weekly|monthly)$")

    # Metadata
    notes: Optional[str] = None


class SpendingControlUpdate(BaseModel):
    """Schema for updating a spending control."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    category_id: Optional[int] = None
    amount: Optional[float] = Field(None, ge=0)
    period: Optional[str] = Field(None, pattern="^(monthly|weekly|one_time)$")
    is_active: Optional[bool] = None
    month: Optional[date] = None
    is_template: Optional[bool] = None
    rollover_amount: Optional[float] = None
    alert_threshold_pct: Optional[int] = Field(None, ge=0, le=100)
    color: Optional[str] = Field(None, pattern="^#[0-9A-Fa-f]{6}$")
    icon: Optional[str] = Field(None, max_length=50)
    goal_id: Optional[int] = None
    rule_type: Optional[str] = Field(None, pattern="^(round_up|percentage|fixed_schedule)$")
    round_up_to: Optional[int] = Field(None, ge=1, le=100)
    percentage: Optional[float] = Field(None, ge=0, le=100)
    frequency: Optional[str] = Field(None, pattern="^(weekly|monthly)$")
    notes: Optional[str] = None


class SpendingControlResponse(BaseModel):
    """Schema for returning a spending control."""
    id: int
    profile_id: int
    name: str
    methodology: str
    category_id: Optional[int]
    amount: float
    period: str
    is_active: bool
    month: Optional[date]
    is_template: bool
    rollover_amount: float
    alert_threshold_pct: int
    color: str
    icon: str
    goal_id: Optional[int]
    rule_type: Optional[str]
    round_up_to: Optional[int]
    percentage: Optional[float]
    frequency: Optional[str]
    total_saved: float
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    # Computed fields
    spent: Optional[float] = None
    remaining: Optional[float] = None
    utilization: Optional[float] = None

    class Config:
        from_attributes = True


class SpendingControlSummary(BaseModel):
    """Summary statistics for spending controls."""
    total_allocated: float
    total_spent: float
    total_remaining: float
    active_count: int
    over_budget_count: int


# ============================================================================
# Helpers
# ============================================================================

def control_to_response(control: SpendingControl, service: Optional[SpendingControlService] = None) -> SpendingControlResponse:
    """Convert SpendingControl model to response schema."""
    response_data = {
        "id": control.id,
        "profile_id": control.profile_id,
        "name": control.name,
        "methodology": control.methodology,
        "category_id": control.category_id,
        "amount": float(control.amount),
        "period": control.period,
        "is_active": control.is_active,
        "month": control.month,
        "is_template": control.is_template,
        "rollover_amount": float(control.rollover_amount or 0),
        "alert_threshold_pct": control.alert_threshold_pct,
        "color": control.color,
        "icon": control.icon,
        "goal_id": control.goal_id,
        "rule_type": control.rule_type,
        "round_up_to": control.round_up_to,
        "percentage": float(control.percentage) if control.percentage else None,
        "frequency": control.frequency,
        "total_saved": float(control.total_saved or 0),
        "notes": control.notes,
        "created_at": control.created_at,
        "updated_at": control.updated_at,
    }

    # Add computed fields if service provided
    if service:
        response_data["spent"] = float(service.get_spending_for_control(control))
        response_data["remaining"] = float(service.get_remaining_amount(control))
        response_data["utilization"] = service.get_utilization_percentage(control)

    return SpendingControlResponse(**response_data)


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/", response_model=List[SpendingControlResponse])
async def list_spending_controls(
    profile_id: Optional[int] = Query(None),
    methodology: Optional[str] = Query(None, pattern="^(budget|envelope|savings_rule)$"),
    is_active: Optional[bool] = Query(None),
    include_stats: bool = Query(False, description="Include spending statistics"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    List all spending controls for the user.

    Filters:
    - profile_id: Filter by profile
    - methodology: Filter by type (budget, envelope, savings_rule)
    - is_active: Filter by active status
    - include_stats: Calculate spent/remaining/utilization
    """
    profile_ids = [p.id for p in current_user.profiles]

    query = db.query(SpendingControl).filter(
        SpendingControl.profile_id.in_(profile_ids)
    )

    if profile_id:
        if profile_id not in profile_ids:
            raise HTTPException(status_code=403, detail="Access denied")
        query = query.filter(SpendingControl.profile_id == profile_id)

    if methodology:
        query = query.filter(SpendingControl.methodology == methodology)

    if is_active is not None:
        query = query.filter(SpendingControl.is_active == is_active)

    controls = query.order_by(SpendingControl.created_at.desc()).all()

    service = SpendingControlService(db) if include_stats else None
    return [control_to_response(c, service) for c in controls]


@router.post("/", response_model=SpendingControlResponse, status_code=status.HTTP_201_CREATED)
async def create_spending_control(
    data: SpendingControlCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Create a new spending control."""
    # Verify profile belongs to user
    profile_ids = [p.id for p in current_user.profiles]
    if data.profile_id not in profile_ids:
        raise HTTPException(status_code=403, detail="Access denied")

    # Validate methodology-specific requirements
    if data.methodology == "budget":
        if not data.month:
            raise HTTPException(status_code=400, detail="Budget methodology requires 'month' field")

    if data.methodology == "savings_rule":
        if not data.rule_type:
            raise HTTPException(status_code=400, detail="Savings rule methodology requires 'rule_type' field")
        if data.rule_type == "round_up" and not data.round_up_to:
            raise HTTPException(status_code=400, detail="Round-up rule requires 'round_up_to' field")
        if data.rule_type == "percentage" and not data.percentage:
            raise HTTPException(status_code=400, detail="Percentage rule requires 'percentage' field")
        if data.rule_type == "fixed_schedule" and not data.frequency:
            raise HTTPException(status_code=400, detail="Fixed schedule rule requires 'frequency' field")

    control = SpendingControl(
        profile_id=data.profile_id,
        name=data.name,
        methodology=data.methodology,
        category_id=data.category_id,
        amount=Decimal(str(data.amount)),
        period=data.period,
        is_active=data.is_active,
        month=data.month,
        is_template=data.is_template,
        rollover_amount=Decimal(str(data.rollover_amount)),
        alert_threshold_pct=data.alert_threshold_pct,
        color=data.color,
        icon=data.icon,
        goal_id=data.goal_id,
        rule_type=data.rule_type,
        round_up_to=data.round_up_to,
        percentage=Decimal(str(data.percentage)) if data.percentage else None,
        frequency=data.frequency,
        notes=data.notes,
    )

    db.add(control)
    db.commit()
    db.refresh(control)

    return control_to_response(control)


@router.get("/summary", response_model=SpendingControlSummary)
async def get_spending_summary(
    profile_id: Optional[int] = Query(None),
    methodology: Optional[str] = Query(None, pattern="^(budget|envelope|savings_rule)$"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get summary statistics for spending controls.

    Filters:
    - profile_id: Filter by profile (defaults to all user's profiles)
    - methodology: Filter by type (budget, envelope, savings_rule)
    """
    profile_ids = [p.id for p in current_user.profiles]

    if profile_id:
        if profile_id not in profile_ids:
            raise HTTPException(status_code=403, detail="Access denied")
        target_profile_id = profile_id
    else:
        # Use first profile by default
        target_profile_id = profile_ids[0] if profile_ids else None

    if not target_profile_id:
        raise HTTPException(status_code=404, detail="No profiles found")

    service = SpendingControlService(db)
    summary = service.get_control_summary(target_profile_id, methodology)

    return SpendingControlSummary(
        total_allocated=summary["total_allocated"],
        total_spent=summary["total_spent"],
        total_remaining=summary["total_remaining"],
        active_count=summary["active_count"],
        over_budget_count=summary["over_budget_count"],
    )


@router.get("/{control_id}", response_model=SpendingControlResponse)
async def get_spending_control(
    control_id: int,
    include_stats: bool = Query(True, description="Include spending statistics"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get a specific spending control by ID."""
    profile_ids = [p.id for p in current_user.profiles]

    control = db.query(SpendingControl).filter(
        SpendingControl.id == control_id,
        SpendingControl.profile_id.in_(profile_ids),
    ).first()

    if not control:
        raise HTTPException(status_code=404, detail="Spending control not found")

    service = SpendingControlService(db) if include_stats else None
    return control_to_response(control, service)


@router.put("/{control_id}", response_model=SpendingControlResponse)
async def update_spending_control(
    control_id: int,
    data: SpendingControlUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Update a spending control."""
    profile_ids = [p.id for p in current_user.profiles]

    control = db.query(SpendingControl).filter(
        SpendingControl.id == control_id,
        SpendingControl.profile_id.in_(profile_ids),
    ).first()

    if not control:
        raise HTTPException(status_code=404, detail="Spending control not found")

    # Update fields
    update_data = data.dict(exclude_unset=True)
    for field, value in update_data.items():
        if field in ["amount", "rollover_amount", "percentage"] and value is not None:
            value = Decimal(str(value))
        setattr(control, field, value)

    db.commit()
    db.refresh(control)

    return control_to_response(control)


@router.delete("/{control_id}")
async def delete_spending_control(
    control_id: int,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Delete a spending control."""
    profile_ids = [p.id for p in current_user.profiles]

    control = db.query(SpendingControl).filter(
        SpendingControl.id == control_id,
        SpendingControl.profile_id.in_(profile_ids),
    ).first()

    if not control:
        raise HTTPException(status_code=404, detail="Spending control not found")

    db.delete(control)
    db.commit()

    audit.log_from_request(
        db, request, audit.RESOURCE_DELETED,
        user_id=current_user.id,
        resource_type="spending_control",
        resource_id=str(control_id)
    )

    return {"message": "Spending control deleted"}


@router.post("/migrate/{source_type}")
async def migrate_from_legacy(
    source_type: str = Field(..., pattern="^(budget|envelope|savings_rule)$"),
    profile_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Migrate legacy budgets, envelopes, or savings rules to unified system.

    This is a one-time migration tool. After migration, the legacy data
    remains intact but new items should use the unified system.
    """
    profile_ids = [p.id for p in current_user.profiles]

    if profile_id:
        if profile_id not in profile_ids:
            raise HTTPException(status_code=403, detail="Access denied")
        target_profile_id = profile_id
    else:
        target_profile_id = profile_ids[0] if profile_ids else None

    if not target_profile_id:
        raise HTTPException(status_code=404, detail="No profiles found")

    service = SpendingControlService(db)
    count = service.migrate_from_legacy(target_profile_id, source_type)

    return {
        "message": f"Migrated {count} {source_type} items to unified spending controls",
        "count": count
    }
