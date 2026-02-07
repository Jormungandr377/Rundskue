"""Auto-categorization rules router."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from ..database import get_db
from ..models import CategoryRule, Category, Transaction, Account, Profile, User
from ..dependencies import get_current_active_user

router = APIRouter(tags=["Auto-Categorization"])


# ============================================================================
# Schemas
# ============================================================================

class RuleCreate(BaseModel):
    category_id: int
    match_field: str = Field(default="name", description="name or merchant_name")
    match_type: str = Field(default="contains", description="contains, exact, or starts_with")
    match_value: str = Field(..., min_length=1, max_length=255)
    priority: int = Field(default=0)


class RuleUpdate(BaseModel):
    category_id: Optional[int] = None
    match_field: Optional[str] = None
    match_type: Optional[str] = None
    match_value: Optional[str] = None
    is_active: Optional[bool] = None
    priority: Optional[int] = None


class RuleResponse(BaseModel):
    id: int
    category_id: int
    category_name: Optional[str] = None
    match_field: str
    match_type: str
    match_value: str
    is_active: bool
    priority: int

    class Config:
        from_attributes = True


class ApplyResult(BaseModel):
    categorized: int
    skipped: int


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


def matches_rule(rule: CategoryRule, txn: Transaction) -> bool:
    """Check if a transaction matches a categorization rule."""
    if rule.match_field == "merchant_name":
        field_value = txn.merchant_name or ""
    else:
        field_value = txn.name or ""

    field_value = field_value.lower()
    match_value = rule.match_value.lower()

    if rule.match_type == "exact":
        return field_value == match_value
    elif rule.match_type == "starts_with":
        return field_value.startswith(match_value)
    else:  # contains
        return match_value in field_value


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/rules", response_model=List[RuleResponse])
async def list_rules(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all categorization rules for the user."""
    profile = get_user_profile(db, current_user)

    rules = db.query(CategoryRule).filter(
        CategoryRule.profile_id == profile.id
    ).order_by(CategoryRule.priority.desc(), CategoryRule.id).all()

    result = []
    for rule in rules:
        cat = db.query(Category).filter(Category.id == rule.category_id).first()
        result.append(RuleResponse(
            id=rule.id,
            category_id=rule.category_id,
            category_name=cat.name if cat else None,
            match_field=rule.match_field,
            match_type=rule.match_type,
            match_value=rule.match_value,
            is_active=rule.is_active,
            priority=rule.priority,
        ))
    return result


@router.post("/rules", response_model=RuleResponse, status_code=status.HTTP_201_CREATED)
async def create_rule(
    data: RuleCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new auto-categorization rule."""
    profile = get_user_profile(db, current_user)

    if data.match_field not in ("name", "merchant_name"):
        raise HTTPException(status_code=400, detail="match_field must be 'name' or 'merchant_name'")
    if data.match_type not in ("contains", "exact", "starts_with"):
        raise HTTPException(status_code=400, detail="match_type must be 'contains', 'exact', or 'starts_with'")

    # Verify category exists
    cat = db.query(Category).filter(Category.id == data.category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    rule = CategoryRule(
        profile_id=profile.id,
        category_id=data.category_id,
        match_field=data.match_field,
        match_type=data.match_type,
        match_value=data.match_value,
        priority=data.priority,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)

    return RuleResponse(
        id=rule.id,
        category_id=rule.category_id,
        category_name=cat.name,
        match_field=rule.match_field,
        match_type=rule.match_type,
        match_value=rule.match_value,
        is_active=rule.is_active,
        priority=rule.priority,
    )


@router.put("/rules/{rule_id}", response_model=RuleResponse)
async def update_rule(
    rule_id: int,
    data: RuleUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update an auto-categorization rule."""
    profile = get_user_profile(db, current_user)

    rule = db.query(CategoryRule).filter(
        CategoryRule.id == rule_id,
        CategoryRule.profile_id == profile.id
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(rule, key, value)

    db.commit()
    db.refresh(rule)

    cat = db.query(Category).filter(Category.id == rule.category_id).first()
    return RuleResponse(
        id=rule.id,
        category_id=rule.category_id,
        category_name=cat.name if cat else None,
        match_field=rule.match_field,
        match_type=rule.match_type,
        match_value=rule.match_value,
        is_active=rule.is_active,
        priority=rule.priority,
    )


@router.delete("/rules/{rule_id}")
async def delete_rule(
    rule_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete an auto-categorization rule."""
    profile = get_user_profile(db, current_user)

    rule = db.query(CategoryRule).filter(
        CategoryRule.id == rule_id,
        CategoryRule.profile_id == profile.id
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    db.delete(rule)
    db.commit()
    return {"message": "Rule deleted"}


@router.post("/apply", response_model=ApplyResult)
async def apply_rules(
    uncategorized_only: bool = True,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Apply all active rules to transactions."""
    profile = get_user_profile(db, current_user)
    profile_ids = [p.id for p in current_user.profiles]

    # Get active rules sorted by priority
    rules = db.query(CategoryRule).filter(
        CategoryRule.profile_id == profile.id,
        CategoryRule.is_active == True
    ).order_by(CategoryRule.priority.desc()).all()

    if not rules:
        return ApplyResult(categorized=0, skipped=0)

    # Get transactions to categorize
    query = db.query(Transaction).join(Account).filter(
        Account.profile_id.in_(profile_ids)
    )
    if uncategorized_only:
        query = query.filter(Transaction.category_id.is_(None))

    txns = query.all()

    categorized = 0
    skipped = 0

    for txn in txns:
        matched = False
        for rule in rules:
            if matches_rule(rule, txn):
                txn.category_id = rule.category_id
                categorized += 1
                matched = True
                break
        if not matched:
            skipped += 1

    db.commit()
    return ApplyResult(categorized=categorized, skipped=skipped)
