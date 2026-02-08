"""Cash flow forecasting router - project future balances based on recurring transactions."""
from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from ..database import get_db
from ..models import Account, RecurringTransaction, Transaction, User
from ..dependencies import get_current_active_user

router = APIRouter()


# ============================================================================
# Schemas
# ============================================================================

class CashFlowEvent(BaseModel):
    name: str
    amount: float
    type: str  # "income" or "expense"


class CashFlowDay(BaseModel):
    date: date
    projected_balance: float
    events: List[CashFlowEvent]
    cumulative_income: float
    cumulative_expenses: float


# ============================================================================
# Helpers
# ============================================================================

def is_due_on_date(rt: RecurringTransaction, check_date: date) -> bool:
    """
    Determine whether a recurring transaction is due on a given date.

    Checks the transaction's frequency against the check_date, considering
    day_of_month, day_of_week, and start_date for biweekly calculations.

    Args:
        rt: The recurring transaction to evaluate.
        check_date: The date to check against.

    Returns:
        True if the transaction is due on check_date, False otherwise.
    """
    # Do not consider transactions that haven't started yet
    if check_date < rt.start_date:
        return False

    # Do not consider transactions that have ended
    if rt.end_date and check_date > rt.end_date:
        return False

    frequency = rt.frequency

    if frequency == "monthly":
        target_day = rt.day_of_month if rt.day_of_month else rt.start_date.day
        # Handle months with fewer days (e.g., day_of_month=31 in February)
        import calendar
        last_day = calendar.monthrange(check_date.year, check_date.month)[1]
        effective_day = min(target_day, last_day)
        return check_date.day == effective_day

    elif frequency == "weekly":
        target_dow = rt.day_of_week if rt.day_of_week is not None else rt.start_date.weekday()
        return check_date.weekday() == target_dow

    elif frequency == "biweekly":
        target_dow = rt.day_of_week if rt.day_of_week is not None else rt.start_date.weekday()
        if check_date.weekday() != target_dow:
            return False
        # Check if the number of days since start_date is a multiple of 14
        delta_days = (check_date - rt.start_date).days
        return delta_days >= 0 and delta_days % 14 == 0

    elif frequency == "quarterly":
        target_day = rt.day_of_month if rt.day_of_month else rt.start_date.day
        import calendar
        last_day = calendar.monthrange(check_date.year, check_date.month)[1]
        effective_day = min(target_day, last_day)
        if check_date.day != effective_day:
            return False
        # Check if the month difference from start_date is a multiple of 3
        month_diff = (check_date.year - rt.start_date.year) * 12 + (check_date.month - rt.start_date.month)
        return month_diff >= 0 and month_diff % 3 == 0

    elif frequency == "yearly":
        target_day = rt.day_of_month if rt.day_of_month else rt.start_date.day
        import calendar
        last_day = calendar.monthrange(check_date.year, check_date.month)[1]
        effective_day = min(target_day, last_day)
        return (
            check_date.month == rt.start_date.month
            and check_date.day == effective_day
        )

    return False


def get_current_balance(db: Session, profile_ids: List[int], profile_id: Optional[int] = None) -> float:
    """
    Calculate the current total balance from all non-hidden accounts
    belonging to the user's profiles.

    Args:
        db: Database session.
        profile_ids: List of profile IDs belonging to the current user.
        profile_id: Optional specific profile ID to filter by.

    Returns:
        The total current balance as a float.
    """
    query = db.query(func.coalesce(func.sum(Account.balance_current), 0)).filter(
        Account.profile_id.in_(profile_ids),
        Account.is_hidden == False,
    )
    if profile_id:
        query = query.filter(Account.profile_id == profile_id)

    total = query.scalar()
    return float(total)


def get_active_recurring(
    db: Session,
    profile_ids: List[int],
    profile_id: Optional[int] = None,
) -> List[RecurringTransaction]:
    """
    Fetch all active recurring transactions for the given profiles.

    Args:
        db: Database session.
        profile_ids: List of profile IDs belonging to the current user.
        profile_id: Optional specific profile ID to filter by.

    Returns:
        A list of active RecurringTransaction objects.
    """
    query = db.query(RecurringTransaction).filter(
        RecurringTransaction.profile_id.in_(profile_ids),
        RecurringTransaction.is_active == True,
    )
    if profile_id:
        query = query.filter(RecurringTransaction.profile_id == profile_id)

    return query.all()


def build_forecast(
    starting_balance: float,
    recurring_transactions: List[RecurringTransaction],
    days: int,
    extra_recurring: Optional[List[dict]] = None,
    excluded_ids: Optional[set] = None,
) -> List[CashFlowDay]:
    """
    Build a day-by-day cash flow forecast.

    Args:
        starting_balance: The current account balance to project from.
        recurring_transactions: Active recurring transactions from the database.
        days: Number of days to forecast.
        extra_recurring: Optional list of synthetic recurring transactions
                         for what-if scenarios (dicts with name, amount, frequency,
                         day_of_month, day_of_week, start_date, is_income).
        excluded_ids: Optional set of recurring transaction IDs to exclude
                      from the forecast (for what-if removal scenarios).

    Returns:
        A list of CashFlowDay objects representing the daily projection.
    """
    today = date.today()
    projected_balance = starting_balance
    cumulative_income = 0.0
    cumulative_expenses = 0.0
    forecast: List[CashFlowDay] = []

    for day_offset in range(days):
        check_date = today + timedelta(days=day_offset)
        day_events: List[CashFlowEvent] = []

        # Check each real recurring transaction
        for rt in recurring_transactions:
            if excluded_ids and rt.id in excluded_ids:
                continue

            if is_due_on_date(rt, check_date):
                amount = float(rt.amount)
                if rt.is_income:
                    projected_balance += amount
                    cumulative_income += amount
                    day_events.append(CashFlowEvent(
                        name=rt.name,
                        amount=amount,
                        type="income",
                    ))
                else:
                    projected_balance -= amount
                    cumulative_expenses += amount
                    day_events.append(CashFlowEvent(
                        name=rt.name,
                        amount=amount,
                        type="expense",
                    ))

        # Check extra synthetic recurring transactions (for scenarios)
        if extra_recurring:
            for extra in extra_recurring:
                if _synthetic_is_due(extra, check_date):
                    amount = extra["amount"]
                    if extra.get("is_income", False):
                        projected_balance += amount
                        cumulative_income += amount
                        day_events.append(CashFlowEvent(
                            name=extra["name"],
                            amount=amount,
                            type="income",
                        ))
                    else:
                        projected_balance -= amount
                        cumulative_expenses += amount
                        day_events.append(CashFlowEvent(
                            name=extra["name"],
                            amount=amount,
                            type="expense",
                        ))

        forecast.append(CashFlowDay(
            date=check_date,
            projected_balance=round(projected_balance, 2),
            events=day_events,
            cumulative_income=round(cumulative_income, 2),
            cumulative_expenses=round(cumulative_expenses, 2),
        ))

    return forecast


def _synthetic_is_due(extra: dict, check_date: date) -> bool:
    """
    Check if a synthetic (scenario) recurring transaction is due on a given date.

    Uses the same logic as is_due_on_date but operates on a plain dict
    instead of a RecurringTransaction ORM object.

    Args:
        extra: Dict with keys: frequency, day_of_month, day_of_week, start_date.
        check_date: The date to check.

    Returns:
        True if the synthetic transaction is due on check_date.
    """
    start = extra.get("start_date", date.today())
    if check_date < start:
        return False

    frequency = extra.get("frequency", "monthly")

    if frequency == "monthly":
        target_day = extra.get("day_of_month") or start.day
        import calendar
        last_day = calendar.monthrange(check_date.year, check_date.month)[1]
        effective_day = min(target_day, last_day)
        return check_date.day == effective_day

    elif frequency == "weekly":
        target_dow = extra.get("day_of_week") if extra.get("day_of_week") is not None else start.weekday()
        return check_date.weekday() == target_dow

    elif frequency == "biweekly":
        target_dow = extra.get("day_of_week") if extra.get("day_of_week") is not None else start.weekday()
        if check_date.weekday() != target_dow:
            return False
        delta_days = (check_date - start).days
        return delta_days >= 0 and delta_days % 14 == 0

    elif frequency == "quarterly":
        target_day = extra.get("day_of_month") or start.day
        import calendar
        last_day = calendar.monthrange(check_date.year, check_date.month)[1]
        effective_day = min(target_day, last_day)
        if check_date.day != effective_day:
            return False
        month_diff = (check_date.year - start.year) * 12 + (check_date.month - start.month)
        return month_diff >= 0 and month_diff % 3 == 0

    elif frequency == "yearly":
        target_day = extra.get("day_of_month") or start.day
        import calendar
        last_day = calendar.monthrange(check_date.year, check_date.month)[1]
        effective_day = min(target_day, last_day)
        return check_date.month == start.month and check_date.day == effective_day

    return False


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/forecast", response_model=List[CashFlowDay])
async def get_forecast(
    profile_id: Optional[int] = None,
    days: int = Query(default=30, ge=1, le=365),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Project daily balances for the next N days based on recurring transactions.

    Uses the current total balance from all non-hidden accounts and applies
    scheduled recurring income and expenses to produce a day-by-day forecast.

    Query Parameters:
        profile_id: Optional profile ID to filter accounts and recurring
                    transactions. Must belong to the current user.
        days: Number of days to forecast (default 30, max 365).
    """
    profile_ids = [p.id for p in current_user.profiles]

    # Validate profile_id ownership
    if profile_id is not None:
        if profile_id not in profile_ids:
            raise HTTPException(status_code=403, detail="Access denied to this profile")

    starting_balance = get_current_balance(db, profile_ids, profile_id)
    recurring = get_active_recurring(db, profile_ids, profile_id)

    forecast = build_forecast(
        starting_balance=starting_balance,
        recurring_transactions=recurring,
        days=days,
    )

    return forecast


@router.get("/scenarios", response_model=List[CashFlowDay])
async def get_scenarios(
    profile_id: Optional[int] = None,
    days: int = Query(default=30, ge=1, le=365),
    add_expense_name: Optional[str] = None,
    add_expense_amount: Optional[float] = None,
    add_expense_frequency: Optional[str] = None,
    remove_recurring_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    What-if scenario forecasting with modifications applied.

    Produces the same day-by-day forecast as /forecast, but allows the caller
    to add a hypothetical recurring expense or remove an existing recurring
    transaction to see how it would affect future balances.

    Query Parameters:
        profile_id: Optional profile ID to filter by.
        days: Number of days to forecast (default 30, max 365).
        add_expense_name: Name of a hypothetical recurring expense to add.
        add_expense_amount: Amount of the hypothetical expense.
        add_expense_frequency: Frequency of the hypothetical expense
                               (monthly, weekly, biweekly, quarterly, yearly).
        remove_recurring_id: ID of an existing recurring transaction to
                             exclude from the forecast.
    """
    profile_ids = [p.id for p in current_user.profiles]

    # Validate profile_id ownership
    if profile_id is not None:
        if profile_id not in profile_ids:
            raise HTTPException(status_code=403, detail="Access denied to this profile")

    starting_balance = get_current_balance(db, profile_ids, profile_id)
    recurring = get_active_recurring(db, profile_ids, profile_id)

    # Build the set of excluded recurring transaction IDs
    excluded_ids: set = set()
    if remove_recurring_id is not None:
        # Verify the recurring transaction belongs to the user
        rt = db.query(RecurringTransaction).filter(
            RecurringTransaction.id == remove_recurring_id,
            RecurringTransaction.profile_id.in_(profile_ids),
        ).first()
        if not rt:
            raise HTTPException(
                status_code=404,
                detail="Recurring transaction not found",
            )
        excluded_ids.add(remove_recurring_id)

    # Build extra synthetic recurring transactions for the scenario
    extra_recurring: List[dict] = []
    if add_expense_name and add_expense_amount is not None:
        valid_frequencies = {"monthly", "weekly", "biweekly", "quarterly", "yearly"}
        frequency = add_expense_frequency or "monthly"
        if frequency not in valid_frequencies:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid frequency. Must be one of: {', '.join(sorted(valid_frequencies))}",
            )
        extra_recurring.append({
            "name": add_expense_name,
            "amount": add_expense_amount,
            "frequency": frequency,
            "day_of_month": date.today().day,
            "day_of_week": date.today().weekday(),
            "start_date": date.today(),
            "is_income": False,
        })

    forecast = build_forecast(
        starting_balance=starting_balance,
        recurring_transactions=recurring,
        days=days,
        extra_recurring=extra_recurring if extra_recurring else None,
        excluded_ids=excluded_ids if excluded_ids else None,
    )

    return forecast
