"""Savings goals management router."""
from datetime import datetime, date
from typing import Optional, List
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from ..database import get_db
from ..models import SavingsGoal, Profile, User, Notification
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


class GoalUpdate(BaseModel):
    name: Optional[str] = None
    target_amount: Optional[float] = None
    current_amount: Optional[float] = None
    deadline: Optional[date] = None
    color: Optional[str] = None
    icon: Optional[str] = None


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

    monthly_needed = None
    if goal.deadline and not goal.is_completed and target > current:
        today = date.today()
        if goal.deadline > today:
            months_left = (goal.deadline.year - today.year) * 12 + (goal.deadline.month - today.month)
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
