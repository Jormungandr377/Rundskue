"""Analytics and reporting service."""
from datetime import date, datetime, timedelta
from decimal import Decimal
from collections import defaultdict
from typing import List, Dict
from sqlalchemy import func, and_, or_, extract
from sqlalchemy.orm import Session

from ..models import (
    Transaction, Account, Category, Profile,
    NetWorthSnapshot, AccountType
)


def get_spending_by_category(
    db: Session,
    profile_id: int = None,
    start_date: date = None,
    end_date: date = None,
    exclude_transfers: bool = True,
    exclude_income: bool = True
) -> List[Dict]:
    """Get spending totals grouped by category."""
    # Build base query
    query = db.query(
        Category.id,
        Category.name,
        Category.color,
        func.sum(Transaction.amount).label("total"),
        func.count(Transaction.id).label("count")
    ).join(
        Transaction, Transaction.category_id == Category.id
    ).join(
        Account, Transaction.account_id == Account.id
    )
    
    # Apply filters
    filters = [Transaction.is_excluded == False]
    
    if profile_id:
        filters.append(Account.profile_id == profile_id)
    
    if start_date:
        filters.append(Transaction.date >= start_date)
    
    if end_date:
        filters.append(Transaction.date <= end_date)
    
    if exclude_transfers:
        filters.append(Transaction.is_transfer == False)
    
    if exclude_income:
        filters.append(Category.is_income == False)
        filters.append(Transaction.amount > 0)  # Positive = expense in Plaid
    
    query = query.filter(and_(*filters))
    query = query.group_by(Category.id, Category.name, Category.color)
    query = query.order_by(func.sum(Transaction.amount).desc())
    
    results = query.all()
    
    # Calculate totals and percentages
    total_spending = sum(r.total for r in results) or Decimal("1")
    
    return [
        {
            "category_id": r.id,
            "category_name": r.name,
            "category_color": r.color or "#6b7280",
            "amount": float(r.total),
            "percentage": float((r.total / total_spending) * 100),
            "transaction_count": r.count
        }
        for r in results
    ]


def get_cash_flow(
    db: Session,
    profile_id: int = None,
    start_date: date = None,
    end_date: date = None,
    group_by: str = "month"  # "month", "week", "day"
) -> List[Dict]:
    """Get income vs expenses over time."""
    # Determine date grouping
    if group_by == "month":
        date_trunc = func.date_trunc("month", Transaction.date)
        date_format = "%Y-%m"
    elif group_by == "week":
        date_trunc = func.date_trunc("week", Transaction.date)
        date_format = "%Y-W%W"
    else:
        date_trunc = Transaction.date
        date_format = "%Y-%m-%d"
    
    # Build base query
    query = db.query(
        date_trunc.label("period"),
        func.sum(
            func.case(
                (Transaction.amount < 0, -Transaction.amount),  # Income (negative in Plaid)
                else_=Decimal("0")
            )
        ).label("income"),
        func.sum(
            func.case(
                (Transaction.amount > 0, Transaction.amount),  # Expense (positive in Plaid)
                else_=Decimal("0")
            )
        ).label("expenses")
    ).join(
        Account, Transaction.account_id == Account.id
    )
    
    # Apply filters
    filters = [
        Transaction.is_excluded == False,
        Transaction.is_transfer == False
    ]
    
    if profile_id:
        filters.append(Account.profile_id == profile_id)
    
    if start_date:
        filters.append(Transaction.date >= start_date)
    
    if end_date:
        filters.append(Transaction.date <= end_date)
    
    query = query.filter(and_(*filters))
    query = query.group_by(date_trunc)
    query = query.order_by(date_trunc)
    
    results = query.all()
    
    return [
        {
            "period": r.period.strftime(date_format) if hasattr(r.period, 'strftime') else str(r.period),
            "income": float(r.income or 0),
            "expenses": float(r.expenses or 0),
            "net": float((r.income or 0) - (r.expenses or 0))
        }
        for r in results
    ]


def get_top_merchants(
    db: Session,
    profile_id: int = None,
    start_date: date = None,
    end_date: date = None,
    limit: int = 10
) -> List[Dict]:
    """Get top merchants by spending."""
    query = db.query(
        func.coalesce(Transaction.merchant_name, Transaction.name).label("merchant"),
        func.sum(Transaction.amount).label("total"),
        func.count(Transaction.id).label("count")
    ).join(
        Account, Transaction.account_id == Account.id
    ).join(
        Category, Transaction.category_id == Category.id, isouter=True
    )
    
    filters = [
        Transaction.is_excluded == False,
        Transaction.is_transfer == False,
        Transaction.amount > 0,  # Expenses only
        or_(Category.is_income == False, Category.id.is_(None))
    ]
    
    if profile_id:
        filters.append(Account.profile_id == profile_id)
    
    if start_date:
        filters.append(Transaction.date >= start_date)
    
    if end_date:
        filters.append(Transaction.date <= end_date)
    
    query = query.filter(and_(*filters))
    query = query.group_by(func.coalesce(Transaction.merchant_name, Transaction.name))
    query = query.order_by(func.sum(Transaction.amount).desc())
    query = query.limit(limit)
    
    results = query.all()
    
    return [
        {
            "merchant": r.merchant,
            "total": float(r.total),
            "transaction_count": r.count
        }
        for r in results
    ]


def calculate_net_worth(db: Session, profile_id: int = None) -> dict:
    """Calculate current net worth from account balances."""
    query = db.query(Account).filter(Account.is_hidden == False)
    
    if profile_id:
        query = query.filter(Account.profile_id == profile_id)
    
    accounts = query.all()
    
    # Group by type
    totals = {
        "cash": Decimal("0"),
        "investments": Decimal("0"),
        "credit": Decimal("0"),
        "loans": Decimal("0"),
    }
    
    breakdown = []
    
    for acc in accounts:
        balance = acc.balance_current or Decimal("0")
        
        account_data = {
            "id": acc.id,
            "name": acc.display_name or acc.name,
            "type": acc.account_type.value,
            "balance": float(balance)
        }
        breakdown.append(account_data)
        
        if acc.account_type in [AccountType.CHECKING, AccountType.SAVINGS]:
            totals["cash"] += balance
        elif acc.account_type == AccountType.INVESTMENT:
            totals["investments"] += balance
        elif acc.account_type == AccountType.CREDIT:
            totals["credit"] += balance  # Usually negative or positive debt
        elif acc.account_type in [AccountType.LOAN, AccountType.MORTGAGE]:
            totals["loans"] += balance
    
    total_assets = totals["cash"] + totals["investments"]
    total_liabilities = totals["credit"] + totals["loans"]
    net_worth = total_assets - total_liabilities
    
    return {
        "date": date.today().isoformat(),
        "total_cash": float(totals["cash"]),
        "total_investments": float(totals["investments"]),
        "total_assets": float(total_assets),
        "total_credit": float(totals["credit"]),
        "total_loans": float(totals["loans"]),
        "total_liabilities": float(total_liabilities),
        "net_worth": float(net_worth),
        "breakdown": breakdown
    }


def save_net_worth_snapshot(db: Session, profile_id: int = None):
    """Save current net worth as a historical snapshot."""
    data = calculate_net_worth(db, profile_id)
    
    # Check if we already have a snapshot for today
    existing = db.query(NetWorthSnapshot).filter(
        NetWorthSnapshot.profile_id == profile_id,
        NetWorthSnapshot.date == date.today()
    ).first()
    
    if existing:
        # Update existing
        existing.total_cash = data["total_cash"]
        existing.total_investments = data["total_investments"]
        existing.total_assets = data["total_assets"]
        existing.total_credit = data["total_credit"]
        existing.total_loans = data["total_loans"]
        existing.total_liabilities = data["total_liabilities"]
        existing.net_worth = data["net_worth"]
        existing.account_breakdown = data["breakdown"]
    else:
        # Create new
        snapshot = NetWorthSnapshot(
            profile_id=profile_id,
            date=date.today(),
            total_cash=data["total_cash"],
            total_investments=data["total_investments"],
            total_assets=data["total_assets"],
            total_credit=data["total_credit"],
            total_loans=data["total_loans"],
            total_liabilities=data["total_liabilities"],
            net_worth=data["net_worth"],
            account_breakdown=data["breakdown"]
        )
        db.add(snapshot)
    
    db.commit()


def get_net_worth_history(
    db: Session,
    profile_id: int = None,
    start_date: date = None,
    end_date: date = None
) -> List[Dict]:
    """Get historical net worth snapshots."""
    query = db.query(NetWorthSnapshot)
    
    if profile_id:
        query = query.filter(NetWorthSnapshot.profile_id == profile_id)
    
    if start_date:
        query = query.filter(NetWorthSnapshot.date >= start_date)
    
    if end_date:
        query = query.filter(NetWorthSnapshot.date <= end_date)
    
    query = query.order_by(NetWorthSnapshot.date)
    
    results = query.all()
    
    return [
        {
            "date": r.date.isoformat(),
            "total_assets": float(r.total_assets),
            "total_liabilities": float(r.total_liabilities),
            "net_worth": float(r.net_worth)
        }
        for r in results
    ]


def get_period_comparison(
    db: Session,
    profile_id: int = None,
    current_start: date = None,
    current_end: date = None,
    previous_start: date = None,
    previous_end: date = None
) -> dict:
    """Compare spending between two periods."""
    current_spending = get_spending_by_category(
        db, profile_id, current_start, current_end
    )
    previous_spending = get_spending_by_category(
        db, profile_id, previous_start, previous_end
    )
    
    # Build lookup for previous period
    previous_by_category = {
        s["category_id"]: s["amount"] 
        for s in previous_spending
    }
    
    # Calculate changes
    comparison = []
    for current in current_spending:
        cat_id = current["category_id"]
        prev_amount = previous_by_category.get(cat_id, 0)
        current_amount = current["amount"]
        
        if prev_amount > 0:
            change_pct = ((current_amount - prev_amount) / prev_amount) * 100
        else:
            change_pct = 100 if current_amount > 0 else 0
        
        comparison.append({
            "category_id": cat_id,
            "category_name": current["category_name"],
            "current_amount": current_amount,
            "previous_amount": prev_amount,
            "change": current_amount - prev_amount,
            "change_percentage": round(change_pct, 1)
        })
    
    current_total = sum(s["amount"] for s in current_spending)
    previous_total = sum(s["amount"] for s in previous_spending)
    
    return {
        "current_total": current_total,
        "previous_total": previous_total,
        "total_change": current_total - previous_total,
        "total_change_percentage": round(
            ((current_total - previous_total) / previous_total * 100) if previous_total > 0 else 0,
            1
        ),
        "by_category": comparison
    }
