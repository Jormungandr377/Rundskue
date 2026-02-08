"""Savings rules router - automated savings via round-ups, percentages, and schedules."""
from typing import List, Optional
from datetime import datetime
import math

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..database import get_db
from ..models import SavingsRule, SavingsGoal, User, Profile
from ..dependencies import get_current_active_user

router = APIRouter()


# ============================================================================
# Schemas
# ============================================================================

class SavingsRuleCreate(BaseModel):
    goal_id: int
    rule_type: str  # round_up, percentage, fixed_schedule
    round_up_to: Optional[int] = None  # 1, 5, 10
    percentage: Optional[float] = None
    fixed_amount: Optional[float] = None
    frequency: Optional[str] = None  # weekly, monthly


class SavingsRuleResponse(BaseModel):
    id: int
    profile_id: int
    goal_id: int
    goal_name: Optional[str] = None
    rule_type: str
    round_up_to: Optional[int]
    percentage: Optional[float]
    fixed_amount: Optional[float]
    frequency: Optional[str]
    is_active: bool
    total_saved: float

    class Config:
        from_attributes = True


class SavingsRuleSummary(BaseModel):
    total_rules: int
    active_rules: int
    total_saved_all_rules: float
    rules_by_type: dict


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/", response_model=List[SavingsRuleResponse])
def list_savings_rules(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """List all savings rules for the user."""
    profile_ids = [p.id for p in current_user.profiles]
    rules = db.query(SavingsRule).filter(
        SavingsRule.profile_id.in_(profile_ids)
    ).order_by(SavingsRule.created_at.desc()).all()

    result = []
    for rule in rules:
        goal = db.query(SavingsGoal).filter(SavingsGoal.id == rule.goal_id).first()
        result.append(SavingsRuleResponse(
            id=rule.id,
            profile_id=rule.profile_id,
            goal_id=rule.goal_id,
            goal_name=goal.name if goal else None,
            rule_type=rule.rule_type,
            round_up_to=rule.round_up_to,
            percentage=float(rule.percentage) if rule.percentage else None,
            fixed_amount=float(rule.fixed_amount) if rule.fixed_amount else None,
            frequency=rule.frequency,
            is_active=rule.is_active,
            total_saved=float(rule.total_saved) if rule.total_saved else 0,
        ))
    return result


@router.get("/summary", response_model=SavingsRuleSummary)
def get_savings_rules_summary(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get summary of savings rules."""
    profile_ids = [p.id for p in current_user.profiles]
    rules = db.query(SavingsRule).filter(
        SavingsRule.profile_id.in_(profile_ids)
    ).all()

    by_type = {}
    for rule in rules:
        by_type[rule.rule_type] = by_type.get(rule.rule_type, 0) + 1

    return SavingsRuleSummary(
        total_rules=len(rules),
        active_rules=sum(1 for r in rules if r.is_active),
        total_saved_all_rules=sum(float(r.total_saved or 0) for r in rules),
        rules_by_type=by_type,
    )


@router.post("/", response_model=SavingsRuleResponse, status_code=status.HTTP_201_CREATED)
def create_savings_rule(
    data: SavingsRuleCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Create a new savings rule."""
    profile_ids = [p.id for p in current_user.profiles]

    # Validate goal belongs to user
    goal = db.query(SavingsGoal).filter(
        SavingsGoal.id == data.goal_id,
        SavingsGoal.profile_id.in_(profile_ids),
    ).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    # Validate rule type
    if data.rule_type not in ("round_up", "percentage", "fixed_schedule"):
        raise HTTPException(status_code=400, detail="Invalid rule_type")

    if data.rule_type == "round_up" and data.round_up_to not in (1, 5, 10):
        raise HTTPException(status_code=400, detail="round_up_to must be 1, 5, or 10")

    if data.rule_type == "percentage" and (not data.percentage or data.percentage <= 0):
        raise HTTPException(status_code=400, detail="percentage must be > 0")

    if data.rule_type == "fixed_schedule" and (not data.fixed_amount or data.fixed_amount <= 0):
        raise HTTPException(status_code=400, detail="fixed_amount must be > 0")

    rule = SavingsRule(
        profile_id=goal.profile_id,
        goal_id=data.goal_id,
        rule_type=data.rule_type,
        round_up_to=data.round_up_to,
        percentage=data.percentage,
        fixed_amount=data.fixed_amount,
        frequency=data.frequency,
        is_active=True,
        total_saved=0,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)

    return SavingsRuleResponse(
        id=rule.id,
        profile_id=rule.profile_id,
        goal_id=rule.goal_id,
        goal_name=goal.name,
        rule_type=rule.rule_type,
        round_up_to=rule.round_up_to,
        percentage=float(rule.percentage) if rule.percentage else None,
        fixed_amount=float(rule.fixed_amount) if rule.fixed_amount else None,
        frequency=rule.frequency,
        is_active=rule.is_active,
        total_saved=0,
    )


@router.put("/{rule_id}", response_model=SavingsRuleResponse)
def update_savings_rule(
    rule_id: int,
    is_active: Optional[bool] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Toggle a savings rule active/inactive."""
    profile_ids = [p.id for p in current_user.profiles]
    rule = db.query(SavingsRule).filter(
        SavingsRule.id == rule_id,
        SavingsRule.profile_id.in_(profile_ids),
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    if is_active is not None:
        rule.is_active = is_active

    db.commit()
    db.refresh(rule)

    goal = db.query(SavingsGoal).filter(SavingsGoal.id == rule.goal_id).first()
    return SavingsRuleResponse(
        id=rule.id,
        profile_id=rule.profile_id,
        goal_id=rule.goal_id,
        goal_name=goal.name if goal else None,
        rule_type=rule.rule_type,
        round_up_to=rule.round_up_to,
        percentage=float(rule.percentage) if rule.percentage else None,
        fixed_amount=float(rule.fixed_amount) if rule.fixed_amount else None,
        frequency=rule.frequency,
        is_active=rule.is_active,
        total_saved=float(rule.total_saved or 0),
    )


@router.delete("/{rule_id}")
def delete_savings_rule(
    rule_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Delete a savings rule."""
    profile_ids = [p.id for p in current_user.profiles]
    rule = db.query(SavingsRule).filter(
        SavingsRule.id == rule_id,
        SavingsRule.profile_id.in_(profile_ids),
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    db.delete(rule)
    db.commit()
    return {"message": "Rule deleted"}


@router.post("/calculate-round-up")
def calculate_round_up(
    amount: float,
    round_up_to: int = 1,
    current_user: User = Depends(get_current_active_user),
):
    """Calculate round-up amount for a given transaction."""
    if round_up_to not in (1, 5, 10):
        raise HTTPException(status_code=400, detail="round_up_to must be 1, 5, or 10")

    rounded = math.ceil(amount / round_up_to) * round_up_to
    savings = round(rounded - amount, 2)
    return {"original": amount, "rounded": rounded, "savings": savings}
