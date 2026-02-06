"""Analytics API router - spending reports, trends, and insights."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, extract, case
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import date, datetime, timedelta
from calendar import monthrange
from decimal import Decimal

from ..database import get_db
from ..models import Transaction, Account, Category, NetWorthSnapshot, User
from ..dependencies import get_current_active_user

router = APIRouter()


class SpendingByCategory(BaseModel):
    category_id: Optional[int]
    category_name: str
    category_icon: Optional[str]
    category_color: Optional[str]
    amount: float
    percentage: float
    transaction_count: int

class MonthlyTrend(BaseModel):
    month: str  # YYYY-MM
    income: float
    expenses: float
    net: float

class CashFlowResponse(BaseModel):
    period_start: date
    period_end: date
    total_income: float
    total_expenses: float
    net_cash_flow: float
    income_by_category: List[SpendingByCategory]
    expenses_by_category: List[SpendingByCategory]

class NetWorthResponse(BaseModel):
    date: date
    total_assets: float
    total_liabilities: float
    net_worth: float
    change_from_previous: Optional[float]

class SpendingInsight(BaseModel):
    type: str  # "increase", "decrease", "over_budget", "unusual"
    category: str
    message: str
    amount: float
    percentage_change: Optional[float]


@router.get("/spending-by-category", response_model=List[SpendingByCategory])
def get_spending_by_category(
    profile_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get spending breakdown by category for a date range."""
    user_profile_ids = [p.id for p in current_user.profiles]

    # Default to current month
    if not start_date:
        today = date.today()
        start_date = date(today.year, today.month, 1)
    if not end_date:
        today = date.today()
        _, last_day = monthrange(today.year, today.month)
        end_date = date(today.year, today.month, last_day)

    query = db.query(
        Transaction.category_id,
        Category.name,
        Category.icon,
        Category.color,
        func.sum(Transaction.amount).label('total'),
        func.count(Transaction.id).label('count')
    ).outerjoin(Category).join(Account).filter(
        Account.profile_id.in_(user_profile_ids),
        Transaction.date >= start_date,
        Transaction.date <= end_date,
        Transaction.is_excluded == False,
        Transaction.is_transfer == False,
        Transaction.amount > 0  # Expenses only
    )

    if profile_id:
        if profile_id not in user_profile_ids:
            raise HTTPException(status_code=403, detail="Access denied to this profile")
        query = query.filter(Account.profile_id == profile_id)
    
    query = query.group_by(
        Transaction.category_id,
        Category.name,
        Category.icon,
        Category.color
    ).order_by(func.sum(Transaction.amount).desc())
    
    results = query.all()
    
    # Calculate total for percentages
    total_spending = sum(float(r.total) for r in results)
    
    categories = []
    for r in results:
        amount = float(r.total)
        categories.append(SpendingByCategory(
            category_id=r.category_id,
            category_name=r.name or "Uncategorized",
            category_icon=r.icon,
            category_color=r.color,
            amount=amount,
            percentage=round(amount / total_spending * 100, 1) if total_spending > 0 else 0,
            transaction_count=r.count
        ))
    
    return categories


@router.get("/cash-flow", response_model=CashFlowResponse)
def get_cash_flow(
    profile_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get cash flow summary with income and expense breakdown."""
    user_profile_ids = [p.id for p in current_user.profiles]

    if profile_id and profile_id not in user_profile_ids:
        raise HTTPException(status_code=403, detail="Access denied to this profile")

    # Default to current month
    if not start_date:
        today = date.today()
        start_date = date(today.year, today.month, 1)
    if not end_date:
        today = date.today()
        _, last_day = monthrange(today.year, today.month)
        end_date = date(today.year, today.month, last_day)

    filter_profile_ids = [profile_id] if profile_id else user_profile_ids

    # Get income (negative amounts)
    income_result = db.query(
        Transaction.category_id,
        Category.name,
        Category.icon,
        Category.color,
        func.sum(Transaction.amount).label('total'),
        func.count(Transaction.id).label('count')
    ).outerjoin(Category).join(Account).filter(
        Account.profile_id.in_(filter_profile_ids),
        Transaction.date >= start_date,
        Transaction.date <= end_date,
        Transaction.is_excluded == False,
        Transaction.is_transfer == False,
        Transaction.amount < 0
    ).group_by(
        Transaction.category_id, Category.name, Category.icon, Category.color
    ).all()

    # Get expenses (positive amounts)
    expense_result = db.query(
        Transaction.category_id,
        Category.name,
        Category.icon,
        Category.color,
        func.sum(Transaction.amount).label('total'),
        func.count(Transaction.id).label('count')
    ).outerjoin(Category).join(Account).filter(
        Account.profile_id.in_(filter_profile_ids),
        Transaction.date >= start_date,
        Transaction.date <= end_date,
        Transaction.is_excluded == False,
        Transaction.is_transfer == False,
        Transaction.amount > 0
    ).group_by(
        Transaction.category_id, Category.name, Category.icon, Category.color
    ).all()
    
    total_income = sum(abs(float(r.total)) for r in income_result)
    total_expenses = sum(float(r.total) for r in expense_result)
    
    income_by_cat = []
    for r in income_result:
        amount = abs(float(r.total))
        income_by_cat.append(SpendingByCategory(
            category_id=r.category_id,
            category_name=r.name or "Other Income",
            category_icon=r.icon,
            category_color=r.color or "#22c55e",
            amount=amount,
            percentage=round(amount / total_income * 100, 1) if total_income > 0 else 0,
            transaction_count=r.count
        ))
    
    expense_by_cat = []
    for r in expense_result:
        amount = float(r.total)
        expense_by_cat.append(SpendingByCategory(
            category_id=r.category_id,
            category_name=r.name or "Uncategorized",
            category_icon=r.icon,
            category_color=r.color,
            amount=amount,
            percentage=round(amount / total_expenses * 100, 1) if total_expenses > 0 else 0,
            transaction_count=r.count
        ))
    
    return CashFlowResponse(
        period_start=start_date,
        period_end=end_date,
        total_income=total_income,
        total_expenses=total_expenses,
        net_cash_flow=total_income - total_expenses,
        income_by_category=sorted(income_by_cat, key=lambda x: x.amount, reverse=True),
        expenses_by_category=sorted(expense_by_cat, key=lambda x: x.amount, reverse=True)
    )


@router.get("/monthly-trends", response_model=List[MonthlyTrend])
def get_monthly_trends(
    profile_id: Optional[int] = None,
    months: int = 12,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get income vs expenses trend over the past N months."""
    user_profile_ids = [p.id for p in current_user.profiles]

    if profile_id and profile_id not in user_profile_ids:
        raise HTTPException(status_code=403, detail="Access denied to this profile")

    today = date.today()
    start_date = date(today.year, today.month, 1) - timedelta(days=30 * months)

    filter_profile_ids = [profile_id] if profile_id else user_profile_ids

    query = db.query(
        extract('year', Transaction.date).label('year'),
        extract('month', Transaction.date).label('month'),
        func.sum(
            case(
                (Transaction.amount < 0, Transaction.amount),
                else_=0
            )
        ).label('income'),
        func.sum(
            case(
                (Transaction.amount > 0, Transaction.amount),
                else_=0
            )
        ).label('expenses')
    ).join(Account).filter(
        Account.profile_id.in_(filter_profile_ids),
        Transaction.date >= start_date,
        Transaction.is_excluded == False,
        Transaction.is_transfer == False
    )
    
    query = query.group_by(
        extract('year', Transaction.date),
        extract('month', Transaction.date)
    ).order_by(
        extract('year', Transaction.date),
        extract('month', Transaction.date)
    )
    
    results = query.all()
    
    trends = []
    for r in results:
        income = abs(float(r.income)) if r.income else 0
        expenses = float(r.expenses) if r.expenses else 0
        trends.append(MonthlyTrend(
            month=f"{int(r.year)}-{int(r.month):02d}",
            income=income,
            expenses=expenses,
            net=income - expenses
        ))
    
    return trends


@router.get("/net-worth-history", response_model=List[NetWorthResponse])
def get_net_worth_history(
    profile_id: Optional[int] = None,
    months: int = 12,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get net worth history over time."""
    user_profile_ids = [p.id for p in current_user.profiles]

    if profile_id and profile_id not in user_profile_ids:
        raise HTTPException(status_code=403, detail="Access denied to this profile")

    start_date = date.today() - timedelta(days=30 * months)

    query = db.query(NetWorthSnapshot).filter(
        NetWorthSnapshot.date >= start_date
    )

    if profile_id:
        query = query.filter(NetWorthSnapshot.profile_id == profile_id)
    else:
        # Show snapshots for user's profiles or household total (profile_id=None)
        query = query.filter(
            or_(
                NetWorthSnapshot.profile_id.in_(user_profile_ids),
                NetWorthSnapshot.profile_id.is_(None)
            )
        )
    
    snapshots = query.order_by(NetWorthSnapshot.date).all()
    
    result = []
    prev_net_worth = None
    
    for s in snapshots:
        change = None
        if prev_net_worth is not None:
            change = float(s.net_worth) - prev_net_worth
        
        result.append(NetWorthResponse(
            date=s.date,
            total_assets=float(s.total_assets),
            total_liabilities=float(s.total_liabilities),
            net_worth=float(s.net_worth),
            change_from_previous=change
        ))
        
        prev_net_worth = float(s.net_worth)
    
    return result


@router.post("/snapshot-net-worth")
def create_net_worth_snapshot(
    profile_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a net worth snapshot based on current account balances."""
    user_profile_ids = [p.id for p in current_user.profiles]

    if profile_id and profile_id not in user_profile_ids:
        raise HTTPException(status_code=403, detail="Access denied to this profile")

    filter_profile_ids = [profile_id] if profile_id else user_profile_ids

    query = db.query(Account).filter(
        Account.is_hidden == False,
        Account.profile_id.in_(filter_profile_ids)
    )

    accounts = query.all()
    
    total_cash = 0
    total_investments = 0
    total_credit = 0
    total_loans = 0
    
    for acc in accounts:
        balance = float(acc.balance_current or 0)
        acc_type = acc.account_type.value if hasattr(acc.account_type, 'value') else acc.account_type
        
        if acc_type in ['checking', 'savings']:
            total_cash += balance
        elif acc_type == 'investment':
            total_investments += balance
        elif acc_type == 'credit':
            total_credit += abs(balance)
        elif acc_type in ['loan', 'mortgage']:
            total_loans += abs(balance)
    
    total_assets = total_cash + total_investments
    total_liabilities = total_credit + total_loans
    net_worth = total_assets - total_liabilities
    
    # Create snapshot
    snapshot = NetWorthSnapshot(
        profile_id=profile_id,
        date=date.today(),
        total_cash=total_cash,
        total_investments=total_investments,
        total_assets=total_assets,
        total_credit=total_credit,
        total_loans=total_loans,
        total_liabilities=total_liabilities,
        net_worth=net_worth
    )
    
    # Check if snapshot already exists for today
    existing = db.query(NetWorthSnapshot).filter(
        NetWorthSnapshot.date == date.today(),
        NetWorthSnapshot.profile_id == profile_id
    ).first()
    
    if existing:
        # Update existing
        for key in ['total_cash', 'total_investments', 'total_assets', 
                    'total_credit', 'total_loans', 'total_liabilities', 'net_worth']:
            setattr(existing, key, getattr(snapshot, key))
    else:
        db.add(snapshot)
    
    db.commit()
    
    return {
        "date": date.today().isoformat(),
        "net_worth": net_worth,
        "total_assets": total_assets,
        "total_liabilities": total_liabilities
    }


@router.get("/insights", response_model=List[SpendingInsight])
def get_spending_insights(
    profile_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get spending insights comparing current month to previous."""
    user_profile_ids = [p.id for p in current_user.profiles]

    if profile_id and profile_id not in user_profile_ids:
        raise HTTPException(status_code=403, detail="Access denied to this profile")

    filter_profile_ids = [profile_id] if profile_id else user_profile_ids

    today = date.today()
    current_month_start = date(today.year, today.month, 1)

    # Previous month
    if today.month == 1:
        prev_month_start = date(today.year - 1, 12, 1)
        prev_month_end = date(today.year - 1, 12, 31)
    else:
        prev_month_start = date(today.year, today.month - 1, 1)
        _, last_day = monthrange(today.year, today.month - 1)
        prev_month_end = date(today.year, today.month - 1, last_day)

    # Get spending by category for both months
    def get_spending(start, end):
        query = db.query(
            Category.name,
            func.sum(Transaction.amount).label('total')
        ).select_from(Transaction).outerjoin(Category).join(Account).filter(
            Account.profile_id.in_(filter_profile_ids),
            Transaction.date >= start,
            Transaction.date <= end,
            Transaction.is_excluded == False,
            Transaction.is_transfer == False,
            Transaction.amount > 0
        )
        return {r.name or "Uncategorized": float(r.total) for r in query.group_by(Category.name).all()}
    
    current_spending = get_spending(current_month_start, today)
    prev_spending = get_spending(prev_month_start, prev_month_end)
    
    insights = []
    
    for category, current_amount in current_spending.items():
        prev_amount = prev_spending.get(category, 0)
        
        if prev_amount > 0:
            pct_change = ((current_amount - prev_amount) / prev_amount) * 100
            
            # Days into month ratio for fair comparison
            days_in_month = monthrange(today.year, today.month)[1]
            adjusted_current = current_amount * (days_in_month / today.day)
            adjusted_pct_change = ((adjusted_current - prev_amount) / prev_amount) * 100
            
            if adjusted_pct_change > 50 and current_amount > 100:
                insights.append(SpendingInsight(
                    type="increase",
                    category=category,
                    message=f"Spending on {category} is tracking {abs(adjusted_pct_change):.0f}% higher than last month",
                    amount=current_amount,
                    percentage_change=adjusted_pct_change
                ))
            elif adjusted_pct_change < -30 and prev_amount > 100:
                insights.append(SpendingInsight(
                    type="decrease",
                    category=category,
                    message=f"Great job! {category} spending is down {abs(adjusted_pct_change):.0f}% from last month",
                    amount=current_amount,
                    percentage_change=adjusted_pct_change
                ))
    
    # Sort by absolute percentage change
    insights.sort(key=lambda x: abs(x.percentage_change or 0), reverse=True)
    
    return insights[:10]  # Top 10 insights
