"""Analytics API router - spending reports, trends, and insights."""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, extract, case
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import date, datetime, timedelta
from calendar import monthrange
from decimal import Decimal

from ..database import get_db
from ..models import Transaction, Account, Category, NetWorthSnapshot, User, BudgetItem, Budget, SavingsGoal, Debt
from ..dependencies import get_current_active_user

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


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
@limiter.limit("60/minute")
def get_spending_by_category(
    request: Request,
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
    months: int = Query(12, ge=1, le=120),
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
    months: int = Query(12, ge=1, le=120),
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


class IncomeExpenseComparison(BaseModel):
    month: str
    income: float
    expenses: float
    net: float
    income_change_pct: Optional[float] = None
    expense_change_pct: Optional[float] = None
    net_change_pct: Optional[float] = None


@router.get("/income-expense-comparison", response_model=List[IncomeExpenseComparison])
def get_income_expense_comparison(
    profile_id: Optional[int] = None,
    months: int = Query(12, ge=1, le=120),
    comparison: Optional[str] = None,  # "yoy" for year-over-year
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get income vs expense comparison with MoM or YoY percentage changes."""
    user_profile_ids = [p.id for p in current_user.profiles]
    if profile_id and profile_id not in user_profile_ids:
        raise HTTPException(status_code=403, detail="Access denied to this profile")

    # Fetch enough months for comparison
    fetch_months = months + (12 if comparison == "yoy" else 1)
    today = date.today()
    start_date = date(today.year, today.month, 1) - timedelta(days=30 * fetch_months)
    filter_profile_ids = [profile_id] if profile_id else user_profile_ids

    query = db.query(
        extract('year', Transaction.date).label('year'),
        extract('month', Transaction.date).label('month'),
        func.sum(case((Transaction.amount < 0, Transaction.amount), else_=0)).label('income'),
        func.sum(case((Transaction.amount > 0, Transaction.amount), else_=0)).label('expenses')
    ).join(Account).filter(
        Account.profile_id.in_(filter_profile_ids),
        Transaction.date >= start_date,
        Transaction.is_excluded == False,
        Transaction.is_transfer == False
    ).group_by(
        extract('year', Transaction.date),
        extract('month', Transaction.date)
    ).order_by(
        extract('year', Transaction.date),
        extract('month', Transaction.date)
    )

    results = query.all()
    monthly_data = {}
    for r in results:
        key = f"{int(r.year)}-{int(r.month):02d}"
        income = abs(float(r.income)) if r.income else 0
        expenses = float(r.expenses) if r.expenses else 0
        monthly_data[key] = {"income": income, "expenses": expenses, "net": income - expenses}

    # Build comparison output (only the requested number of months)
    output = []
    sorted_months = sorted(monthly_data.keys())
    target_months = sorted_months[-months:] if len(sorted_months) > months else sorted_months

    for month_key in target_months:
        data = monthly_data[month_key]
        year, mon = int(month_key.split("-")[0]), int(month_key.split("-")[1])

        # Determine comparison period
        if comparison == "yoy":
            comp_key = f"{year - 1}-{mon:02d}"
        else:
            # MoM: previous month
            if mon == 1:
                comp_key = f"{year - 1}-12"
            else:
                comp_key = f"{year}-{mon - 1:02d}"

        comp = monthly_data.get(comp_key)
        income_pct = None
        expense_pct = None
        net_pct = None
        if comp:
            if comp["income"] > 0:
                income_pct = round((data["income"] - comp["income"]) / comp["income"] * 100, 1)
            if comp["expenses"] > 0:
                expense_pct = round((data["expenses"] - comp["expenses"]) / comp["expenses"] * 100, 1)
            if comp["net"] != 0:
                net_pct = round((data["net"] - comp["net"]) / abs(comp["net"]) * 100, 1)

        output.append(IncomeExpenseComparison(
            month=month_key,
            income=data["income"],
            expenses=data["expenses"],
            net=data["net"],
            income_change_pct=income_pct,
            expense_change_pct=expense_pct,
            net_change_pct=net_pct,
        ))

    return output


# ── New Schemas ──────────────────────────────────────────────────────────────

class HeatmapDay(BaseModel):
    date: str
    amount: float


class MerchantAnalysisItem(BaseModel):
    merchant_name: str
    total_spent: float
    transaction_count: int
    avg_amount: float
    first_seen: date
    last_seen: date
    top_category: Optional[str]


class HealthScoreResponse(BaseModel):
    overall_score: float
    savings_rate_score: float
    debt_ratio_score: float
    emergency_fund_score: float
    budget_adherence_score: float
    tips: List[str]


class TopCategoryItem(BaseModel):
    name: str
    amount: float


class TopMerchantItem(BaseModel):
    name: str
    amount: float
    count: int


class BiggestExpenseItem(BaseModel):
    name: str
    amount: float
    date: date


class MostFrequentMerchantItem(BaseModel):
    name: str
    count: int


class MonthData(BaseModel):
    month: str
    income: float
    expenses: float
    net: float


class BestWorstMonth(BaseModel):
    month: str
    net: float


class YearInReviewResponse(BaseModel):
    total_income: float
    total_expenses: float
    net_savings: float
    top_categories: List[TopCategoryItem]
    top_merchants: List[TopMerchantItem]
    biggest_expense: Optional[BiggestExpenseItem]
    most_frequent_merchant: Optional[MostFrequentMerchantItem]
    avg_daily_spend: float
    best_month: Optional[BestWorstMonth]
    worst_month: Optional[BestWorstMonth]
    months_data: List[MonthData]


# ── 1. Spending Heatmap ─────────────────────────────────────────────────────

@router.get("/spending-heatmap", response_model=List[HeatmapDay])
@limiter.limit("30/minute")
def get_spending_heatmap(
    request: Request,
    profile_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Return daily spending totals for the past year (expenses only)."""
    user_profile_ids = [p.id for p in current_user.profiles]

    if profile_id and profile_id not in user_profile_ids:
        raise HTTPException(status_code=403, detail="Access denied to this profile")

    filter_profile_ids = [profile_id] if profile_id else user_profile_ids
    one_year_ago = date.today() - timedelta(days=365)

    results = (
        db.query(
            Transaction.date,
            func.sum(Transaction.amount).label("total"),
        )
        .join(Account)
        .filter(
            Account.profile_id.in_(filter_profile_ids),
            Transaction.date >= one_year_ago,
            Transaction.is_excluded == False,
            Transaction.is_transfer == False,
            Transaction.amount > 0,
        )
        .group_by(Transaction.date)
        .order_by(Transaction.date)
        .all()
    )

    return [
        HeatmapDay(date=r.date.isoformat(), amount=float(r.total))
        for r in results
    ]


# ── 2. Merchant Analysis ────────────────────────────────────────────────────

@router.get("/merchant-analysis", response_model=List[MerchantAnalysisItem])
@limiter.limit("30/minute")
def get_merchant_analysis(
    request: Request,
    profile_id: Optional[int] = None,
    limit: int = Query(50, ge=1, le=500),
    sort_by: str = "total_spent",
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Analyse spending by merchant with totals, counts, and top category."""
    user_profile_ids = [p.id for p in current_user.profiles]

    if profile_id and profile_id not in user_profile_ids:
        raise HTTPException(status_code=403, detail="Access denied to this profile")

    if sort_by not in ("total_spent", "transaction_count", "avg_amount"):
        raise HTTPException(status_code=400, detail="Invalid sort_by value")

    filter_profile_ids = [profile_id] if profile_id else user_profile_ids

    # Use merchant_name when available, fall back to name
    merchant_col = func.coalesce(Transaction.merchant_name, Transaction.name)

    query = (
        db.query(
            merchant_col.label("merchant"),
            func.sum(Transaction.amount).label("total_spent"),
            func.count(Transaction.id).label("transaction_count"),
            func.avg(Transaction.amount).label("avg_amount"),
            func.min(Transaction.date).label("first_seen"),
            func.max(Transaction.date).label("last_seen"),
        )
        .join(Account)
        .filter(
            Account.profile_id.in_(filter_profile_ids),
            Transaction.is_excluded == False,
            Transaction.is_transfer == False,
            Transaction.amount > 0,
        )
        .group_by(merchant_col)
    )

    sort_map = {
        "total_spent": func.sum(Transaction.amount).desc(),
        "transaction_count": func.count(Transaction.id).desc(),
        "avg_amount": func.avg(Transaction.amount).desc(),
    }
    query = query.order_by(sort_map[sort_by])
    merchants = query.limit(limit).all()

    # Build a set of merchant names for the top-category subquery
    merchant_names = [m.merchant for m in merchants]

    # Pre-compute top category per merchant in bulk:
    # For each merchant, find the category_id that appears most often
    top_cats: Dict[str, Optional[str]] = {}
    if merchant_names:
        cat_counts = (
            db.query(
                func.coalesce(Transaction.merchant_name, Transaction.name).label("merchant"),
                Category.name.label("cat_name"),
                func.count(Transaction.id).label("cnt"),
            )
            .join(Account)
            .outerjoin(Category)
            .filter(
                Account.profile_id.in_(filter_profile_ids),
                Transaction.is_excluded == False,
                Transaction.is_transfer == False,
                Transaction.amount > 0,
                func.coalesce(Transaction.merchant_name, Transaction.name).in_(merchant_names),
                Transaction.category_id.isnot(None),
            )
            .group_by(
                func.coalesce(Transaction.merchant_name, Transaction.name),
                Category.name,
            )
            .all()
        )

        # Pick the category with the highest count for each merchant
        best: Dict[str, tuple] = {}
        for row in cat_counts:
            prev = best.get(row.merchant)
            if prev is None or row.cnt > prev[1]:
                best[row.merchant] = (row.cat_name, row.cnt)
        top_cats = {k: v[0] for k, v in best.items()}

    return [
        MerchantAnalysisItem(
            merchant_name=m.merchant,
            total_spent=float(m.total_spent),
            transaction_count=m.transaction_count,
            avg_amount=round(float(m.avg_amount), 2),
            first_seen=m.first_seen,
            last_seen=m.last_seen,
            top_category=top_cats.get(m.merchant),
        )
        for m in merchants
    ]


# ── 3. Financial Health Score ────────────────────────────────────────────────

@router.get("/health-score", response_model=HealthScoreResponse)
@limiter.limit("30/minute")
def get_health_score(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Calculate a composite financial health score (0-100)."""
    profile_ids = [p.id for p in current_user.profiles]
    today = date.today()
    month_start = date(today.year, today.month, 1)
    _, last_day = monthrange(today.year, today.month)
    month_end = date(today.year, today.month, last_day)

    tips: List[str] = []

    # ── Savings Rate (25 pts) ────────────────────────────────────────────────
    income_row = (
        db.query(func.sum(Transaction.amount))
        .join(Account)
        .filter(
            Account.profile_id.in_(profile_ids),
            Transaction.date >= month_start,
            Transaction.date <= month_end,
            Transaction.is_excluded == False,
            Transaction.is_transfer == False,
            Transaction.amount < 0,
        )
        .scalar()
    )
    monthly_income = abs(float(income_row)) if income_row else 0.0

    expense_row = (
        db.query(func.sum(Transaction.amount))
        .join(Account)
        .filter(
            Account.profile_id.in_(profile_ids),
            Transaction.date >= month_start,
            Transaction.date <= month_end,
            Transaction.is_excluded == False,
            Transaction.is_transfer == False,
            Transaction.amount > 0,
        )
        .scalar()
    )
    monthly_expenses = float(expense_row) if expense_row else 0.0

    if monthly_income > 0:
        savings_rate = (monthly_income - monthly_expenses) / monthly_income * 100
    else:
        savings_rate = 0.0

    if savings_rate > 20:
        savings_rate_score = 25.0
    elif savings_rate > 10:
        savings_rate_score = 15.0
    elif savings_rate > 0:
        savings_rate_score = 10.0
    else:
        savings_rate_score = 0.0

    if savings_rate_score < 25:
        tips.append("Aim to save at least 20% of your income each month.")

    # ── Debt Ratio (25 pts) ──────────────────────────────────────────────────
    debts = db.query(Debt).filter(Debt.profile_id.in_(profile_ids)).all()

    if not debts:
        debt_ratio_score = 25.0
    else:
        total_min_payments = sum(float(d.minimum_payment) for d in debts)
        if monthly_income > 0:
            debt_ratio = total_min_payments / monthly_income * 100
        else:
            debt_ratio = 100.0

        if debt_ratio < 20:
            debt_ratio_score = 25.0
        elif debt_ratio < 30:
            debt_ratio_score = 20.0
        elif debt_ratio < 40:
            debt_ratio_score = 15.0
        else:
            debt_ratio_score = 5.0

        if debt_ratio_score < 25:
            tips.append(
                f"Your debt payments consume {debt_ratio:.0f}% of income. "
                "Try to reduce this below 20%."
            )

    # ── Emergency Fund (25 pts) ──────────────────────────────────────────────
    emergency_goals = (
        db.query(SavingsGoal)
        .filter(
            SavingsGoal.profile_id.in_(profile_ids),
            SavingsGoal.is_emergency_fund == True,
        )
        .all()
    )

    if emergency_goals:
        total_current = sum(float(g.current_amount or 0) for g in emergency_goals)
        total_target = sum(float(g.target_amount or 1) for g in emergency_goals)
        emergency_fund_score = min(total_current / total_target * 25, 25.0)
    else:
        emergency_fund_score = 0.0
        tips.append("Create an emergency fund goal to improve your financial safety net.")

    # ── Budget Adherence (25 pts) ────────────────────────────────────────────
    current_budgets = (
        db.query(Budget)
        .filter(
            Budget.profile_id.in_(profile_ids),
            Budget.month == month_start,
        )
        .all()
    )

    budget_adherence_score = 0.0
    if current_budgets:
        total_items = 0
        within_budget_items = 0

        for budget in current_budgets:
            items = (
                db.query(BudgetItem)
                .filter(BudgetItem.budget_id == budget.id)
                .all()
            )
            for item in items:
                total_items += 1
                budgeted = float(item.amount) + float(item.rollover_amount or 0)

                actual_row = (
                    db.query(func.sum(Transaction.amount))
                    .join(Account)
                    .filter(
                        Account.profile_id.in_(profile_ids),
                        Transaction.category_id == item.category_id,
                        Transaction.date >= month_start,
                        Transaction.date <= month_end,
                        Transaction.is_excluded == False,
                        Transaction.is_transfer == False,
                        Transaction.amount > 0,
                    )
                    .scalar()
                )
                actual_spent = float(actual_row) if actual_row else 0.0

                if actual_spent <= budgeted:
                    within_budget_items += 1

        if total_items > 0:
            budget_adherence_score = (within_budget_items / total_items) * 25.0
            overbudget = total_items - within_budget_items
            if overbudget > 0:
                tips.append(
                    f"{overbudget} of {total_items} budget categories are over budget this month."
                )
    else:
        tips.append("Set up a monthly budget to track your spending against targets.")

    overall_score = round(
        savings_rate_score + debt_ratio_score + emergency_fund_score + budget_adherence_score, 1
    )

    return HealthScoreResponse(
        overall_score=overall_score,
        savings_rate_score=round(savings_rate_score, 1),
        debt_ratio_score=round(debt_ratio_score, 1),
        emergency_fund_score=round(emergency_fund_score, 1),
        budget_adherence_score=round(budget_adherence_score, 1),
        tips=tips,
    )


# ── 4. Year-in-Review ───────────────────────────────────────────────────────

@router.get("/year-in-review", response_model=YearInReviewResponse)
@limiter.limit("10/minute")
def get_year_in_review(
    request: Request,
    year: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Comprehensive annual financial summary."""
    profile_ids = [p.id for p in current_user.profiles]

    if year is None:
        year = date.today().year

    year_start = date(year, 1, 1)
    year_end = date(year, 12, 31)

    base_filter = [
        Account.profile_id.in_(profile_ids),
        Transaction.date >= year_start,
        Transaction.date <= year_end,
        Transaction.is_excluded == False,
        Transaction.is_transfer == False,
    ]

    # ── Totals ───────────────────────────────────────────────────────────────
    income_scalar = (
        db.query(func.sum(Transaction.amount))
        .join(Account)
        .filter(*base_filter, Transaction.amount < 0)
        .scalar()
    )
    total_income = abs(float(income_scalar)) if income_scalar else 0.0

    expense_scalar = (
        db.query(func.sum(Transaction.amount))
        .join(Account)
        .filter(*base_filter, Transaction.amount > 0)
        .scalar()
    )
    total_expenses = float(expense_scalar) if expense_scalar else 0.0
    net_savings = total_income - total_expenses

    # ── Top 5 categories (expenses) ──────────────────────────────────────────
    cat_rows = (
        db.query(
            Category.name,
            func.sum(Transaction.amount).label("total"),
        )
        .select_from(Transaction)
        .outerjoin(Category)
        .join(Account)
        .filter(*base_filter, Transaction.amount > 0)
        .group_by(Category.name)
        .order_by(func.sum(Transaction.amount).desc())
        .limit(5)
        .all()
    )
    top_categories = [
        TopCategoryItem(name=r.name or "Uncategorized", amount=float(r.total))
        for r in cat_rows
    ]

    # ── Top 5 merchants (expenses) ───────────────────────────────────────────
    merchant_col = func.coalesce(Transaction.merchant_name, Transaction.name)
    merch_rows = (
        db.query(
            merchant_col.label("merchant"),
            func.sum(Transaction.amount).label("total"),
            func.count(Transaction.id).label("cnt"),
        )
        .join(Account)
        .filter(*base_filter, Transaction.amount > 0)
        .group_by(merchant_col)
        .order_by(func.sum(Transaction.amount).desc())
        .limit(5)
        .all()
    )
    top_merchants = [
        TopMerchantItem(name=r.merchant, amount=float(r.total), count=r.cnt)
        for r in merch_rows
    ]

    # ── Biggest single expense ───────────────────────────────────────────────
    biggest = (
        db.query(Transaction)
        .join(Account)
        .filter(*base_filter, Transaction.amount > 0)
        .order_by(Transaction.amount.desc())
        .first()
    )
    biggest_expense = None
    if biggest:
        biggest_expense = BiggestExpenseItem(
            name=biggest.merchant_name or biggest.name,
            amount=float(biggest.amount),
            date=biggest.date,
        )

    # ── Most frequent merchant ───────────────────────────────────────────────
    freq_row = (
        db.query(
            merchant_col.label("merchant"),
            func.count(Transaction.id).label("cnt"),
        )
        .join(Account)
        .filter(*base_filter, Transaction.amount > 0)
        .group_by(merchant_col)
        .order_by(func.count(Transaction.id).desc())
        .first()
    )
    most_frequent_merchant = None
    if freq_row:
        most_frequent_merchant = MostFrequentMerchantItem(
            name=freq_row.merchant, count=freq_row.cnt
        )

    # ── Average daily spend ──────────────────────────────────────────────────
    today = date.today()
    if year == today.year:
        days_elapsed = (today - year_start).days or 1
    else:
        days_elapsed = (year_end - year_start).days + 1
    avg_daily_spend = round(total_expenses / days_elapsed, 2) if days_elapsed > 0 else 0.0

    # ── Monthly breakdown ────────────────────────────────────────────────────
    monthly_rows = (
        db.query(
            extract("month", Transaction.date).label("m"),
            func.sum(
                case((Transaction.amount < 0, Transaction.amount), else_=0)
            ).label("inc"),
            func.sum(
                case((Transaction.amount > 0, Transaction.amount), else_=0)
            ).label("exp"),
        )
        .join(Account)
        .filter(*base_filter)
        .group_by(extract("month", Transaction.date))
        .order_by(extract("month", Transaction.date))
        .all()
    )

    months_data: List[MonthData] = []
    best_month: Optional[BestWorstMonth] = None
    worst_month: Optional[BestWorstMonth] = None

    for r in monthly_rows:
        inc = abs(float(r.inc)) if r.inc else 0.0
        exp = float(r.exp) if r.exp else 0.0
        net = inc - exp
        month_label = f"{year}-{int(r.m):02d}"

        months_data.append(MonthData(month=month_label, income=inc, expenses=exp, net=net))

        if best_month is None or net > best_month.net:
            best_month = BestWorstMonth(month=month_label, net=net)
        if worst_month is None or net < worst_month.net:
            worst_month = BestWorstMonth(month=month_label, net=net)

    return YearInReviewResponse(
        total_income=total_income,
        total_expenses=total_expenses,
        net_savings=net_savings,
        top_categories=top_categories,
        top_merchants=top_merchants,
        biggest_expense=biggest_expense,
        most_frequent_merchant=most_frequent_merchant,
        avg_daily_spend=avg_daily_spend,
        best_month=best_month,
        worst_month=worst_month,
        months_data=months_data,
    )
