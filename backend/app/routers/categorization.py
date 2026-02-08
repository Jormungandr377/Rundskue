"""Auto-categorization rules router."""
from typing import List, Optional, Dict
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, Field

from ..database import get_db
from ..models import CategoryRule, Category, Transaction, Account, Profile, User
from ..dependencies import get_current_active_user
from ..services import audit

router = APIRouter(tags=["Auto-Categorization"])
limiter = Limiter(key_func=get_remote_address)


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


def _escape_like(value: str) -> str:
    """Escape SQL LIKE wildcard characters."""
    return value.replace("%", r"\%").replace("_", r"\_")


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
    request: Request,
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
    audit.log_from_request(db, request, audit.RESOURCE_DELETED, user_id=current_user.id, resource_type="category_rule", resource_id=str(rule_id))
    return {"message": "Rule deleted"}


@router.post("/apply", response_model=ApplyResult)
@limiter.limit("10/minute")
async def apply_rules(
    request: Request,
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


# ============================================================================
# Smart Categorization (Phase 8)
# ============================================================================

class SuggestionResponse(BaseModel):
    transaction_id: int
    transaction_name: str
    merchant_name: Optional[str] = None
    suggested_category_id: Optional[int] = None
    suggested_category_name: Optional[str] = None
    confidence: str  # high, medium, low
    source: str  # rule, history, plaid


@router.get("/suggestions", response_model=List[SuggestionResponse])
async def get_suggestions(
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get category suggestions for uncategorized transactions."""
    profile = get_user_profile(db, current_user)
    profile_ids = [p.id for p in current_user.profiles]

    # Get uncategorized transactions
    uncategorized = db.query(Transaction).join(Account).filter(
        Account.profile_id.in_(profile_ids),
        Transaction.category_id.is_(None),
        Transaction.is_excluded == False,
    ).order_by(Transaction.date.desc()).limit(limit).all()

    # Get active rules
    rules = db.query(CategoryRule).filter(
        CategoryRule.profile_id == profile.id,
        CategoryRule.is_active == True,
    ).order_by(CategoryRule.priority.desc()).all()

    # Build merchant -> category frequency map from categorized transactions
    categorized_txns = db.query(
        Transaction.merchant_name,
        Transaction.category_id,
        func.count(Transaction.id).label("cnt"),
    ).join(Account).filter(
        Account.profile_id.in_(profile_ids),
        Transaction.category_id.isnot(None),
        Transaction.merchant_name.isnot(None),
    ).group_by(
        Transaction.merchant_name,
        Transaction.category_id,
    ).all()

    merchant_category_map: Dict[str, List[tuple]] = {}
    for merchant, cat_id, cnt in categorized_txns:
        key = (merchant or "").lower().strip()
        if key:
            if key not in merchant_category_map:
                merchant_category_map[key] = []
            merchant_category_map[key].append((cat_id, cnt))

    # Plaid category mapping (from categorization service)
    from ..services.categorization import categorize_transaction as plaid_categorize

    suggestions = []
    for txn in uncategorized:
        suggested_cat_id = None
        confidence = "low"
        source = "plaid"

        # 1. Try rules first (highest confidence)
        for rule in rules:
            if matches_rule(rule, txn):
                suggested_cat_id = rule.category_id
                confidence = "high"
                source = "rule"
                break

        # 2. Try merchant history (medium-high confidence)
        if not suggested_cat_id:
            merchant_key = ((txn.merchant_name or txn.name) or "").lower().strip()
            if merchant_key in merchant_category_map:
                # Pick the most frequent category for this merchant
                candidates = merchant_category_map[merchant_key]
                candidates.sort(key=lambda x: x[1], reverse=True)
                if candidates:
                    suggested_cat_id = candidates[0][0]
                    total = sum(c[1] for c in candidates)
                    top_count = candidates[0][1]
                    confidence = "high" if top_count / total > 0.8 else "medium"
                    source = "history"

        # 3. Try Plaid-based categorization (low confidence)
        if not suggested_cat_id:
            plaid_cats = txn.plaid_category if txn.plaid_category else None
            result = plaid_categorize(db, txn.merchant_name or txn.name, plaid_cats)
            if result:
                # Check it's not just "Uncategorized"
                cat = db.query(Category).filter(Category.id == result).first()
                if cat and cat.name != "Uncategorized":
                    suggested_cat_id = result
                    confidence = "low"
                    source = "plaid"

        if suggested_cat_id:
            cat = db.query(Category).filter(Category.id == suggested_cat_id).first()
            suggestions.append(SuggestionResponse(
                transaction_id=txn.id,
                transaction_name=txn.custom_name or txn.name,
                merchant_name=txn.merchant_name,
                suggested_category_id=suggested_cat_id,
                suggested_category_name=cat.name if cat else None,
                confidence=confidence,
                source=source,
            ))

    return suggestions


class LearnRequest(BaseModel):
    transaction_id: int
    category_id: int


class LearnResponse(BaseModel):
    categorized: bool
    rule_created: bool
    rule_id: Optional[int] = None


@router.post("/learn", response_model=LearnResponse)
async def learn_from_categorization(
    data: LearnRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Learn from manual categorization - auto-create rule if merchant appears 3+ times."""
    profile = get_user_profile(db, current_user)
    profile_ids = [p.id for p in current_user.profiles]

    # Get the transaction
    txn = db.query(Transaction).join(Account).filter(
        Transaction.id == data.transaction_id,
        Account.profile_id.in_(profile_ids),
    ).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Verify category exists
    cat = db.query(Category).filter(Category.id == data.category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    # Categorize the transaction
    txn.category_id = data.category_id
    rule_created = False
    rule_id = None

    # Check if this merchant appears 3+ times and doesn't have a rule yet
    merchant = txn.merchant_name or txn.name
    if merchant:
        merchant_lower = merchant.lower().strip()

        # Count how many transactions have this merchant
        merchant_count = db.query(func.count(Transaction.id)).join(Account).filter(
            Account.profile_id.in_(profile_ids),
            func.lower(func.coalesce(Transaction.merchant_name, Transaction.name)).like(f"%{_escape_like(merchant_lower)}%"),
        ).scalar() or 0

        if merchant_count >= 3:
            # Check if a rule already exists for this merchant+category
            existing_rule = db.query(CategoryRule).filter(
                CategoryRule.profile_id == profile.id,
                func.lower(CategoryRule.match_value) == merchant_lower,
                CategoryRule.category_id == data.category_id,
            ).first()

            if not existing_rule:
                new_rule = CategoryRule(
                    profile_id=profile.id,
                    category_id=data.category_id,
                    match_field="merchant_name" if txn.merchant_name else "name",
                    match_type="contains",
                    match_value=merchant_lower,
                    priority=5,
                )
                db.add(new_rule)
                db.flush()
                rule_created = True
                rule_id = new_rule.id

    db.commit()
    return LearnResponse(
        categorized=True,
        rule_created=rule_created,
        rule_id=rule_id,
    )
