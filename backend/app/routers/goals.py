"""Savings goals management router."""
from datetime import datetime, date, timedelta
from typing import Optional, List
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, Field

from ..database import get_db
from ..models import SavingsGoal, Profile, User, Notification, Transaction, Account
from ..dependencies import get_current_active_user

router = APIRouter(tags=["Savings Goals"])


# ============================================================================
# Schemas
# ============================================================================

class GoalCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    target_amount: float = Field(..., gt=0)
    current_amount: float = Field(default=0, ge=0)
    deadline: Optional[date] = None
    color: str = Field(default="#3b82f6", max_length=7)
    icon: str = Field(default="piggy-bank", max_length=50)
    is_emergency_fund: bool = False
    fund_type: str = "general"  # general, sinking_fund, emergency
    target_date: Optional[date] = None


class GoalUpdate(BaseModel):
    name: Optional[str] = None
    target_amount: Optional[float] = None
    current_amount: Optional[float] = None
    deadline: Optional[date] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    is_emergency_fund: Optional[bool] = None
    fund_type: Optional[str] = None
    target_date: Optional[date] = None


class GoalContribution(BaseModel):
    amount: float = Field(..., gt=0)


class GoalResponse(BaseModel):
    id: int
    name: str
    target_amount: float
    current_amount: float
    deadline: Optional[date]
    color: str
    icon: str
    is_completed: bool
    completed_at: Optional[datetime]
    progress_pct: float
    monthly_needed: Optional[float] = None
    is_emergency_fund: bool = False
    fund_type: str = "general"
    target_date: Optional[date] = None
    monthly_contribution: Optional[float] = None

    class Config:
        from_attributes = True


# ============================================================================
# Helpers
# ============================================================================

def get_user_profile(db: Session, user) -> Profile:
    profile = db.query(Profile).filter(
        Profile.user_id == user.id,
        Profile.is_primary == True
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="No primary profile found")
    return profile


def goal_to_response(goal: SavingsGoal) -> GoalResponse:
    target = float(goal.target_amount) if goal.target_amount else 0
    current = float(goal.current_amount) if goal.current_amount else 0
    progress = min((current / target * 100) if target > 0 else 0, 100)

    # Calculate monthly needed from deadline or target_date
    monthly_needed = None
    effective_deadline = goal.target_date or goal.deadline
    if effective_deadline and not goal.is_completed and target > current:
        today = date.today()
        if effective_deadline > today:
            months_left = (effective_deadline.year - today.year) * 12 + (effective_deadline.month - today.month)
            if months_left > 0:
                monthly_needed = (target - current) / months_left

    return GoalResponse(
        id=goal.id,
        name=goal.name,
        target_amount=target,
        current_amount=current,
        deadline=goal.deadline,
        color=goal.color or "#3b82f6",
        icon=goal.icon or "piggy-bank",
        is_completed=goal.is_completed,
        completed_at=goal.completed_at,
        progress_pct=round(progress, 1),
        monthly_needed=round(monthly_needed, 2) if monthly_needed else None,
        is_emergency_fund=goal.is_emergency_fund or False,
        fund_type=goal.fund_type or "general",
        target_date=goal.target_date,
        monthly_contribution=float(goal.monthly_contribution) if goal.monthly_contribution else None,
    )


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/", response_model=List[GoalResponse])
async def list_goals(
    include_completed: bool = False,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all savings goals for the user."""
    profile = get_user_profile(db, current_user)

    query = db.query(SavingsGoal).filter(SavingsGoal.profile_id == profile.id)
    if not include_completed:
        query = query.filter(SavingsGoal.is_completed == False)

    goals = query.order_by(SavingsGoal.created_at.desc()).all()
    return [goal_to_response(g) for g in goals]


@router.post("/", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
async def create_goal(
    data: GoalCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new savings goal."""
    profile = get_user_profile(db, current_user)

    goal = SavingsGoal(
        profile_id=profile.id,
        name=data.name,
        target_amount=data.target_amount,
        current_amount=data.current_amount,
        deadline=data.deadline,
        color=data.color,
        icon=data.icon,
        is_emergency_fund=data.is_emergency_fund,
        fund_type=data.fund_type,
        target_date=data.target_date,
    )

    # Check if already completed on creation
    if data.current_amount >= data.target_amount:
        goal.is_completed = True
        goal.completed_at = datetime.utcnow()

    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal_to_response(goal)


@router.get("/{goal_id}", response_model=GoalResponse)
async def get_goal(
    goal_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific savings goal."""
    profile = get_user_profile(db, current_user)

    goal = db.query(SavingsGoal).filter(
        SavingsGoal.id == goal_id,
        SavingsGoal.profile_id == profile.id
    ).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    return goal_to_response(goal)


@router.put("/{goal_id}", response_model=GoalResponse)
async def update_goal(
    goal_id: int,
    data: GoalUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a savings goal."""
    profile = get_user_profile(db, current_user)

    goal = db.query(SavingsGoal).filter(
        SavingsGoal.id == goal_id,
        SavingsGoal.profile_id == profile.id
    ).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(goal, key, value)

    # Check completion
    target = float(goal.target_amount) if goal.target_amount else 0
    current = float(goal.current_amount) if goal.current_amount else 0
    if current >= target and not goal.is_completed:
        goal.is_completed = True
        goal.completed_at = datetime.utcnow()
        # Create notification
        notif = Notification(
            user_id=current_user.id,
            type="goal_reached",
            title="Goal Reached!",
            message=f"Congratulations! You've reached your savings goal: {goal.name}",
            data={"goal_id": goal.id, "amount": target},
        )
        db.add(notif)

    db.commit()
    db.refresh(goal)
    return goal_to_response(goal)


@router.post("/{goal_id}/contribute", response_model=GoalResponse)
async def contribute_to_goal(
    goal_id: int,
    contribution: GoalContribution,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Add a contribution to a savings goal."""
    profile = get_user_profile(db, current_user)

    goal = db.query(SavingsGoal).filter(
        SavingsGoal.id == goal_id,
        SavingsGoal.profile_id == profile.id
    ).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    goal.current_amount = float(goal.current_amount or 0) + contribution.amount

    # Check completion
    target = float(goal.target_amount) if goal.target_amount else 0
    current = float(goal.current_amount)
    if current >= target and not goal.is_completed:
        goal.is_completed = True
        goal.completed_at = datetime.utcnow()
        notif = Notification(
            user_id=current_user.id,
            type="goal_reached",
            title="Goal Reached!",
            message=f"Congratulations! You've reached your savings goal: {goal.name}",
            data={"goal_id": goal.id, "amount": target},
        )
        db.add(notif)

    db.commit()
    db.refresh(goal)
    return goal_to_response(goal)


@router.delete("/{goal_id}")
async def delete_goal(
    goal_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a savings goal."""
    profile = get_user_profile(db, current_user)

    goal = db.query(SavingsGoal).filter(
        SavingsGoal.id == goal_id,
        SavingsGoal.profile_id == profile.id
    ).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    db.delete(goal)
    db.commit()
    return {"message": "Goal deleted"}


# ============================================================================
# Emergency Fund & Sinking Fund Endpoints
# ============================================================================

@router.get("/emergency-fund")
async def get_emergency_fund(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get emergency fund goal with recommended target based on average spending."""
    profile = get_user_profile(db, current_user)
    profile_ids = [p.id for p in current_user.profiles]

    # Find emergency fund goal
    ef_goal = db.query(SavingsGoal).filter(
        SavingsGoal.profile_id == profile.id,
        SavingsGoal.is_emergency_fund == True,
    ).first()

    # Calculate average monthly expenses from last 3 months
    today = date.today()
    three_months_ago = today - timedelta(days=90)

    total_expenses = db.query(func.sum(Transaction.amount)).join(Account).filter(
        Account.profile_id.in_(profile_ids),
        Transaction.date >= three_months_ago,
        Transaction.amount > 0,
        Transaction.is_excluded == False,
        Transaction.is_transfer == False,
    ).scalar()

    avg_monthly = float(total_expenses or 0) / 3
    recommended_3mo = round(avg_monthly * 3, 2)
    recommended_6mo = round(avg_monthly * 6, 2)

    result = {
        "avg_monthly_expenses": round(avg_monthly, 2),
        "recommended_3_months": recommended_3mo,
        "recommended_6_months": recommended_6mo,
        "goal": goal_to_response(ef_goal) if ef_goal else None,
        "months_covered": 0,
    }

    if ef_goal and avg_monthly > 0:
        result["months_covered"] = round(float(ef_goal.current_amount or 0) / avg_monthly, 1)

    return result


@router.get("/sinking-funds", response_model=List[GoalResponse])
async def list_sinking_funds(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all sinking fund goals."""
    profile = get_user_profile(db, current_user)
    goals = db.query(SavingsGoal).filter(
        SavingsGoal.profile_id == profile.id,
        SavingsGoal.fund_type == "sinking_fund",
        SavingsGoal.is_completed == False,
    ).order_by(SavingsGoal.target_date.asc().nullslast()).all()
    return [goal_to_response(g) for g in goals]
