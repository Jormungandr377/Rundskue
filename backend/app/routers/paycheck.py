"""Paycheck splitting rules router - auto-allocate income to envelopes, goals, and categories."""
import logging
from typing import List, Optional
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel

from ..database import get_db
from ..models import PaycheckRule, PaycheckAllocation, User, Profile, Transaction, SavingsGoal, Envelope, Account
from ..dependencies import get_current_active_user

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================================
# Schemas
# ============================================================================

class AllocationCreate(BaseModel):
    target_type: str  # envelope, goal, category
    target_id: int
    amount_type: str  # fixed, percentage
    amount: float
    priority: int = 0


class PaycheckRuleCreate(BaseModel):
    profile_id: int
    name: str
    match_merchant: str
    match_amount_min: Optional[float] = None
    match_amount_max: Optional[float] = None
    allocations: List[AllocationCreate] = []


class PaycheckRuleUpdate(BaseModel):
    name: Optional[str] = None
    match_merchant: Optional[str] = None
    match_amount_min: Optional[float] = None
    match_amount_max: Optional[float] = None
    is_active: Optional[bool] = None
    allocations: Optional[List[AllocationCreate]] = None


class AllocationResponse(BaseModel):
    id: int
    target_type: str
    target_id: int
    amount_type: str
    amount: float
    priority: int

    class Config:
        from_attributes = True


class PaycheckRuleResponse(BaseModel):
    id: int
    profile_id: int
    name: str
    match_merchant: str
    match_amount_min: Optional[float]
    match_amount_max: Optional[float]
    is_active: bool
    allocations: List[AllocationResponse]

    class Config:
        from_attributes = True


class ApplyResultItem(BaseModel):
    allocation_id: int
    target_type: str
    target_id: int
    amount_type: str
    amount_applied: float
    action: str  # e.g. "goal_contribution", "envelope_assigned"


class ApplyResult(BaseModel):
    rule_id: int
    transaction_id: int
    transaction_amount: float
    applied: List[ApplyResultItem]


# ============================================================================
# Helpers
# ============================================================================

def _validate_percentage_allocations(allocations: List[AllocationCreate]) -> None:
    """Validate that percentage-type allocations do not exceed 100%."""
    total_pct = sum(a.amount for a in allocations if a.amount_type == "percentage")
    if total_pct > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Percentage allocations sum to {total_pct}%, which exceeds 100%",
        )


def _validate_allocation_fields(allocation: AllocationCreate) -> None:
    """Validate individual allocation field values."""
    if allocation.target_type not in ("envelope", "goal", "category"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid target_type '{allocation.target_type}'. Must be 'envelope', 'goal', or 'category'.",
        )
    if allocation.amount_type not in ("fixed", "percentage"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid amount_type '{allocation.amount_type}'. Must be 'fixed' or 'percentage'.",
        )
    if allocation.amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Allocation amount must be greater than 0.",
        )


def _get_user_profile_ids(current_user: User) -> List[int]:
    """Get all profile IDs belonging to the current user."""
    return [p.id for p in current_user.profiles]


def _verify_profile_access(profile_id: int, profile_ids: List[int]) -> None:
    """Verify the user has access to the specified profile."""
    if profile_id not in profile_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this profile",
        )


def _get_rule_or_404(
    db: Session, rule_id: int, profile_ids: List[int]
) -> PaycheckRule:
    """Fetch a paycheck rule, ensuring it belongs to one of the user's profiles."""
    rule = (
        db.query(PaycheckRule)
        .options(joinedload(PaycheckRule.allocations))
        .filter(
            PaycheckRule.id == rule_id,
            PaycheckRule.profile_id.in_(profile_ids),
        )
        .first()
    )
    if not rule:
        raise HTTPException(status_code=404, detail="Paycheck rule not found")
    return rule


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/", response_model=List[PaycheckRuleResponse])
def list_paycheck_rules(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """List all paycheck splitting rules for the user's profiles."""
    profile_ids = _get_user_profile_ids(current_user)

    rules = (
        db.query(PaycheckRule)
        .options(joinedload(PaycheckRule.allocations))
        .filter(PaycheckRule.profile_id.in_(profile_ids))
        .order_by(PaycheckRule.name)
        .all()
    )

    return rules


@router.post("/", response_model=PaycheckRuleResponse, status_code=status.HTTP_201_CREATED)
def create_paycheck_rule(
    data: PaycheckRuleCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Create a new paycheck splitting rule with allocations."""
    profile_ids = _get_user_profile_ids(current_user)
    _verify_profile_access(data.profile_id, profile_ids)

    # Validate allocations
    for alloc in data.allocations:
        _validate_allocation_fields(alloc)
    _validate_percentage_allocations(data.allocations)

    # Create the rule
    rule = PaycheckRule(
        profile_id=data.profile_id,
        name=data.name,
        match_merchant=data.match_merchant,
        match_amount_min=data.match_amount_min,
        match_amount_max=data.match_amount_max,
        is_active=True,
    )
    db.add(rule)
    db.flush()  # Get the rule.id before creating allocations

    # Create allocations
    for alloc in data.allocations:
        db_alloc = PaycheckAllocation(
            rule_id=rule.id,
            target_type=alloc.target_type,
            target_id=alloc.target_id,
            amount_type=alloc.amount_type,
            amount=alloc.amount,
            priority=alloc.priority,
        )
        db.add(db_alloc)

    db.commit()
    db.refresh(rule)

    # Re-query with joinedload to populate allocations in response
    rule = (
        db.query(PaycheckRule)
        .options(joinedload(PaycheckRule.allocations))
        .filter(PaycheckRule.id == rule.id)
        .first()
    )

    return rule


@router.put("/{rule_id}", response_model=PaycheckRuleResponse)
def update_paycheck_rule(
    rule_id: int,
    data: PaycheckRuleUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Update a paycheck splitting rule and optionally replace its allocations."""
    profile_ids = _get_user_profile_ids(current_user)
    rule = _get_rule_or_404(db, rule_id, profile_ids)

    # Update scalar fields
    if data.name is not None:
        rule.name = data.name
    if data.match_merchant is not None:
        rule.match_merchant = data.match_merchant
    if data.match_amount_min is not None:
        rule.match_amount_min = data.match_amount_min
    if data.match_amount_max is not None:
        rule.match_amount_max = data.match_amount_max
    if data.is_active is not None:
        rule.is_active = data.is_active

    # Replace allocations if provided
    if data.allocations is not None:
        for alloc in data.allocations:
            _validate_allocation_fields(alloc)
        _validate_percentage_allocations(data.allocations)

        # Delete old allocations
        db.query(PaycheckAllocation).filter(
            PaycheckAllocation.rule_id == rule.id
        ).delete(synchronize_session=False)

        # Create new allocations
        for alloc in data.allocations:
            db_alloc = PaycheckAllocation(
                rule_id=rule.id,
                target_type=alloc.target_type,
                target_id=alloc.target_id,
                amount_type=alloc.amount_type,
                amount=alloc.amount,
                priority=alloc.priority,
            )
            db.add(db_alloc)

    db.commit()

    # Re-query with joinedload to get fresh allocations
    rule = (
        db.query(PaycheckRule)
        .options(joinedload(PaycheckRule.allocations))
        .filter(PaycheckRule.id == rule.id)
        .first()
    )

    return rule


@router.delete("/{rule_id}")
def delete_paycheck_rule(
    rule_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Delete a paycheck splitting rule (cascade deletes its allocations)."""
    profile_ids = _get_user_profile_ids(current_user)
    rule = _get_rule_or_404(db, rule_id, profile_ids)

    # Delete allocations first, then the rule
    db.query(PaycheckAllocation).filter(
        PaycheckAllocation.rule_id == rule.id
    ).delete(synchronize_session=False)

    db.delete(rule)
    db.commit()

    return {"message": "Paycheck rule deleted"}


@router.post("/{rule_id}/apply/{transaction_id}", response_model=ApplyResult)
def apply_rule_to_transaction(
    rule_id: int,
    transaction_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Manually apply a paycheck splitting rule to a specific transaction.

    For each allocation in the rule (ordered by priority):
    - If target_type is "goal": adds a contribution to the savings goal.
    - If target_type is "envelope": assigns the transaction to the envelope.
    - If target_type is "category": assigns the category to the transaction.

    Fixed amounts are applied directly. Percentage amounts are calculated
    from the absolute value of the transaction amount.
    """
    profile_ids = _get_user_profile_ids(current_user)
    rule = _get_rule_or_404(db, rule_id, profile_ids)

    if not rule.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot apply an inactive rule",
        )

    # Fetch the transaction and verify ownership
    transaction = (
        db.query(Transaction)
        .join(Account)
        .filter(
            Transaction.id == transaction_id,
            Account.profile_id.in_(profile_ids),
        )
        .first()
    )
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    transaction_amount = abs(float(transaction.amount))

    # Sort allocations by priority (higher priority first)
    sorted_allocations = sorted(rule.allocations, key=lambda a: a.priority, reverse=True)

    applied: List[ApplyResultItem] = []

    for alloc in sorted_allocations:
        # Calculate the amount to apply
        if alloc.amount_type == "fixed":
            amount_to_apply = float(alloc.amount)
        else:  # percentage
            amount_to_apply = round(transaction_amount * float(alloc.amount) / 100, 2)

        action = "unknown"

        if alloc.target_type == "goal":
            # Add contribution to savings goal
            goal = db.query(SavingsGoal).filter(
                SavingsGoal.id == alloc.target_id,
                SavingsGoal.profile_id.in_(profile_ids),
            ).first()
            if goal:
                goal.current_amount = float(goal.current_amount or 0) + amount_to_apply
                # Check if goal is now completed
                if float(goal.current_amount) >= float(goal.target_amount) and not goal.is_completed:
                    from datetime import datetime
                    goal.is_completed = True
                    goal.completed_at = datetime.utcnow()
                action = "goal_contribution"
            else:
                logger.warning(f"Goal {alloc.target_id} not found for allocation {alloc.id}")
                continue

        elif alloc.target_type == "envelope":
            # Assign transaction to envelope
            envelope = db.query(Envelope).filter(
                Envelope.id == alloc.target_id,
                Envelope.profile_id.in_(profile_ids),
            ).first()
            if envelope:
                transaction.envelope_id = envelope.id
                action = "envelope_assigned"
            else:
                logger.warning(f"Envelope {alloc.target_id} not found for allocation {alloc.id}")
                continue

        elif alloc.target_type == "category":
            # Assign category to the transaction
            transaction.category_id = alloc.target_id
            action = "category_assigned"

        applied.append(ApplyResultItem(
            allocation_id=alloc.id,
            target_type=alloc.target_type,
            target_id=alloc.target_id,
            amount_type=alloc.amount_type,
            amount_applied=amount_to_apply,
            action=action,
        ))

    db.commit()

    return ApplyResult(
        rule_id=rule.id,
        transaction_id=transaction.id,
        transaction_amount=transaction_amount,
        applied=applied,
    )
