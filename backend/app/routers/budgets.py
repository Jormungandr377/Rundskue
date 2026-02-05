"""Budgets API router - manage monthly budgets."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_
from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime
from calendar import monthrange

from ..database import get_db
from ..models import Budget, BudgetItem, Category, Transaction, Account

router = APIRouter()


class BudgetItemCreate(BaseModel):
    category_id: int
    amount: float

class BudgetItemResponse(BaseModel):
    id: int
    category_id: int
    category_name: str
    category_icon: Optional[str]
    category_color: Optional[str]
    budgeted: float
    spent: float
    remaining: float
    percent_used: float
    
    class Config:
        from_attributes = True

class BudgetCreate(BaseModel):
    profile_id: int
    name: str
    month: date  # First day of month
    items: List[BudgetItemCreate]

class BudgetResponse(BaseModel):
    id: int
    profile_id: int
    name: str
    month: date
    is_template: bool
    total_budgeted: float
    total_spent: float
    items: List[BudgetItemResponse]
    
    class Config:
        from_attributes = True

class BudgetSummary(BaseModel):
    month: date
    total_budgeted: float
    total_spent: float
    total_income: float
    remaining: float
    categories_over_budget: int


def get_spending_by_category(db: Session, profile_id: int, start_date: date, end_date: date) -> dict:
    """Get total spending grouped by category for a date range."""
    # Join transactions with accounts to filter by profile
    result = db.query(
        Transaction.category_id,
        func.sum(Transaction.amount).label('total')
    ).join(Account).filter(
        Account.profile_id == profile_id,
        Transaction.date >= start_date,
        Transaction.date <= end_date,
        Transaction.is_excluded == False,
        Transaction.is_transfer == False,
        Transaction.amount > 0  # Expenses only
    ).group_by(Transaction.category_id).all()
    
    return {r.category_id: float(r.total) for r in result}


def get_income_for_period(db: Session, profile_id: int, start_date: date, end_date: date) -> float:
    """Get total income for a date range."""
    result = db.query(func.sum(Transaction.amount)).join(Account).filter(
        Account.profile_id == profile_id,
        Transaction.date >= start_date,
        Transaction.date <= end_date,
        Transaction.is_excluded == False,
        Transaction.amount < 0  # Income is negative
    ).scalar()
    
    return abs(float(result)) if result else 0


@router.get("/", response_model=List[BudgetResponse])
def get_budgets(
    profile_id: int,
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get all budgets for a profile, optionally filtered by month."""
    query = db.query(Budget).filter(Budget.profile_id == profile_id)
    
    if year and month:
        target_month = date(year, month, 1)
        query = query.filter(Budget.month == target_month)
    
    budgets = query.options(joinedload(Budget.items).joinedload(BudgetItem.category)).all()
    
    result = []
    for budget in budgets:
        # Get the month's date range
        _, last_day = monthrange(budget.month.year, budget.month.month)
        end_date = date(budget.month.year, budget.month.month, last_day)
        
        # Get spending by category
        spending = get_spending_by_category(db, budget.profile_id, budget.month, end_date)
        
        items = []
        total_budgeted = 0
        total_spent = 0
        
        for item in budget.items:
            spent = spending.get(item.category_id, 0)
            budgeted = float(item.amount)
            remaining = budgeted - spent
            percent = (spent / budgeted * 100) if budgeted > 0 else 0
            
            items.append(BudgetItemResponse(
                id=item.id,
                category_id=item.category_id,
                category_name=item.category.name,
                category_icon=item.category.icon,
                category_color=item.category.color,
                budgeted=budgeted,
                spent=spent,
                remaining=remaining,
                percent_used=min(percent, 100)
            ))
            
            total_budgeted += budgeted
            total_spent += spent
        
        result.append(BudgetResponse(
            id=budget.id,
            profile_id=budget.profile_id,
            name=budget.name,
            month=budget.month,
            is_template=budget.is_template,
            total_budgeted=total_budgeted,
            total_spent=total_spent,
            items=sorted(items, key=lambda x: x.spent, reverse=True)
        ))
    
    return result


@router.get("/summary", response_model=BudgetSummary)
def get_budget_summary(
    profile_id: int,
    year: int,
    month: int,
    db: Session = Depends(get_db)
):
    """Get budget summary for a specific month."""
    target_month = date(year, month, 1)
    _, last_day = monthrange(year, month)
    end_date = date(year, month, last_day)
    
    # Get budget
    budget = db.query(Budget).filter(
        Budget.profile_id == profile_id,
        Budget.month == target_month
    ).first()
    
    total_budgeted = 0
    categories_over = 0
    
    if budget:
        spending = get_spending_by_category(db, profile_id, target_month, end_date)
        
        for item in budget.items:
            budgeted = float(item.amount)
            spent = spending.get(item.category_id, 0)
            total_budgeted += budgeted
            if spent > budgeted:
                categories_over += 1
    
    # Get total spending (all categories, not just budgeted)
    total_spent_result = db.query(func.sum(Transaction.amount)).join(Account).filter(
        Account.profile_id == profile_id,
        Transaction.date >= target_month,
        Transaction.date <= end_date,
        Transaction.is_excluded == False,
        Transaction.is_transfer == False,
        Transaction.amount > 0
    ).scalar()
    
    total_spent = float(total_spent_result) if total_spent_result else 0
    total_income = get_income_for_period(db, profile_id, target_month, end_date)
    
    return BudgetSummary(
        month=target_month,
        total_budgeted=total_budgeted,
        total_spent=total_spent,
        total_income=total_income,
        remaining=total_income - total_spent,
        categories_over_budget=categories_over
    )


@router.post("/", response_model=BudgetResponse)
def create_budget(budget: BudgetCreate, db: Session = Depends(get_db)):
    """Create a new monthly budget."""
    # Check if budget already exists for this month
    existing = db.query(Budget).filter(
        Budget.profile_id == budget.profile_id,
        Budget.month == budget.month
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Budget already exists for this month. Use PUT to update."
        )
    
    # Create budget
    db_budget = Budget(
        profile_id=budget.profile_id,
        name=budget.name,
        month=budget.month
    )
    db.add(db_budget)
    db.flush()
    
    # Add items
    for item in budget.items:
        db_item = BudgetItem(
            budget_id=db_budget.id,
            category_id=item.category_id,
            amount=item.amount
        )
        db.add(db_item)
    
    db.commit()
    
    return get_budgets(budget.profile_id, budget.month.year, budget.month.month, db)[0]


@router.get("/{budget_id}/progress")
def get_budget_progress(budget_id: int, db: Session = Depends(get_db)):
    """Get progress details for a specific budget."""
    budget = db.query(Budget).options(
        joinedload(Budget.items).joinedload(BudgetItem.category)
    ).filter(Budget.id == budget_id).first()

    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    # Get the month's date range
    _, last_day = monthrange(budget.month.year, budget.month.month)
    end_date = date(budget.month.year, budget.month.month, last_day)

    # Get spending by category
    spending = get_spending_by_category(db, budget.profile_id, budget.month, end_date)

    items = []
    total_budgeted = 0
    total_spent = 0

    for item in budget.items:
        spent = spending.get(item.category_id, 0)
        budgeted = float(item.amount)
        remaining = budgeted - spent
        percentage = (spent / budgeted * 100) if budgeted > 0 else 0

        items.append({
            "id": item.id,
            "budget_id": budget_id,
            "category_id": item.category_id,
            "amount": budgeted,
            "spent": spent,
            "remaining": remaining,
            "percentage": min(percentage, 100),
            "category": {
                "id": item.category.id,
                "name": item.category.name,
                "icon": item.category.icon,
                "color": item.category.color,
                "is_income": item.category.is_income,
            } if item.category else None,
        })

        total_budgeted += budgeted
        total_spent += spent

    return {
        "budget_id": budget_id,
        "month": budget.month.isoformat(),
        "items": sorted(items, key=lambda x: x["spent"], reverse=True),
        "total_budgeted": total_budgeted,
        "total_spent": total_spent,
    }


@router.put("/{budget_id}", response_model=BudgetResponse)
def update_budget(
    budget_id: int,
    items: List[BudgetItemCreate],
    db: Session = Depends(get_db)
):
    """Update budget items."""
    budget = db.query(Budget).filter(Budget.id == budget_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    
    # Delete existing items
    db.query(BudgetItem).filter(BudgetItem.budget_id == budget_id).delete()
    
    # Add new items
    for item in items:
        db_item = BudgetItem(
            budget_id=budget_id,
            category_id=item.category_id,
            amount=item.amount
        )
        db.add(db_item)
    
    db.commit()
    
    return get_budgets(budget.profile_id, budget.month.year, budget.month.month, db)[0]


@router.post("/copy-from-template")
def copy_from_template(
    profile_id: int,
    target_year: int,
    target_month: int,
    db: Session = Depends(get_db)
):
    """Copy the template budget to a new month."""
    template = db.query(Budget).filter(
        Budget.profile_id == profile_id,
        Budget.is_template == True
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="No template budget found")
    
    target_date = date(target_year, target_month, 1)
    
    # Check if budget already exists
    existing = db.query(Budget).filter(
        Budget.profile_id == profile_id,
        Budget.month == target_date
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Budget already exists for this month")
    
    # Create new budget from template
    new_budget = Budget(
        profile_id=profile_id,
        name=f"Budget {target_date.strftime('%B %Y')}",
        month=target_date,
        is_template=False
    )
    db.add(new_budget)
    db.flush()
    
    # Copy items
    for item in template.items:
        new_item = BudgetItem(
            budget_id=new_budget.id,
            category_id=item.category_id,
            amount=item.amount
        )
        db.add(new_item)
    
    db.commit()
    
    return {"status": "created", "budget_id": new_budget.id}


@router.delete("/{budget_id}")
def delete_budget(budget_id: int, db: Session = Depends(get_db)):
    """Delete a budget."""
    budget = db.query(Budget).filter(Budget.id == budget_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    
    db.delete(budget)
    db.commit()
    
    return {"status": "deleted"}
