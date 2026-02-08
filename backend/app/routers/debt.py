"""Debt payoff planning router - manage debts and generate payoff strategies."""
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel, Field

from ..database import get_db
from ..models import Debt, User, Profile, CreditScore
from ..dependencies import get_current_active_user
from ..services import audit
from ..services.credit_health import CreditHealthService

router = APIRouter(tags=["Debt Payoff"])

VALID_LOAN_TYPES = {"mortgage", "auto", "student", "personal", "credit_card", "other"}


# ============================================================================
# Schemas
# ============================================================================

class DebtCreate(BaseModel):
    """Schema for creating a new debt entry."""
    profile_id: int
    account_id: Optional[int] = None
    name: str = Field(..., min_length=1, max_length=255)
    balance: float = Field(..., gt=0)
    interest_rate: float = Field(..., ge=0, le=100)
    minimum_payment: float = Field(..., gt=0)
    loan_type: str = Field(..., max_length=30)
    start_date: Optional[date] = None
    original_balance: Optional[float] = None
    extra_info: Optional[dict] = None


class DebtUpdate(BaseModel):
    """Schema for partially updating a debt entry."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    balance: Optional[float] = Field(None, gt=0)
    interest_rate: Optional[float] = Field(None, ge=0, le=100)
    minimum_payment: Optional[float] = Field(None, gt=0)
    loan_type: Optional[str] = Field(None, max_length=30)
    account_id: Optional[int] = None
    start_date: Optional[date] = None
    original_balance: Optional[float] = None
    extra_info: Optional[dict] = None
    payoff_impact: Optional[int] = None
    priority: Optional[int] = None


class DebtResponse(BaseModel):
    """Schema for returning a debt record."""
    id: int
    profile_id: int
    account_id: Optional[int]
    name: str
    balance: float
    interest_rate: float
    minimum_payment: float
    loan_type: str
    start_date: Optional[date]
    original_balance: Optional[float]
    extra_info: Optional[dict]
    payoff_impact: Optional[int] = None
    priority: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PayoffScheduleMonth(BaseModel):
    """A single month entry in a debt payoff schedule."""
    debt_id: int
    debt_name: str
    month_number: int
    payment: float
    principal: float
    interest: float
    remaining_balance: float


class PayoffPlan(BaseModel):
    """Complete payoff plan for all debts under a given strategy."""
    strategy: str
    total_months: int
    total_interest: float
    total_paid: float
    payoff_date: date
    schedule: List[PayoffScheduleMonth]


class StrategyComparison(BaseModel):
    """Side-by-side comparison of snowball vs avalanche strategies."""
    snowball: PayoffPlan
    avalanche: PayoffPlan
    months_saved: int
    interest_saved: float


class AmortizationMonth(BaseModel):
    """A single month in an amortization table."""
    month_number: int
    payment: float
    principal: float
    interest: float
    remaining_balance: float


class TotalInterestSummary(BaseModel):
    """Aggregate interest summary across all debts."""
    total_balance: float
    total_minimum_payments: float
    total_interest_if_minimum_only: float
    estimated_payoff_months: int


# ============================================================================
# Helpers
# ============================================================================

def debt_to_response(debt: Debt) -> DebtResponse:
    """Convert a Debt ORM object to a DebtResponse schema."""
    return DebtResponse(
        id=debt.id,
        profile_id=debt.profile_id,
        account_id=debt.account_id,
        name=debt.name,
        balance=float(debt.balance),
        interest_rate=float(debt.interest_rate),
        minimum_payment=float(debt.minimum_payment),
        loan_type=debt.loan_type,
        start_date=debt.start_date,
        original_balance=float(debt.original_balance) if debt.original_balance else None,
        extra_info=debt.extra_info,
        payoff_impact=debt.payoff_impact,
        priority=debt.priority,
        created_at=debt.created_at,
        updated_at=debt.updated_at,
    )


def compute_payoff_plan(debts_data: list, strategy: str, extra_payment: float) -> PayoffPlan:
    """
    Compute a full payoff plan using either snowball or avalanche strategy.

    Args:
        debts_data: List of dicts with keys: id, name, balance, interest_rate, minimum_payment
        strategy: 'snowball' (smallest balance first) or 'avalanche' (highest rate first)
        extra_payment: Additional monthly payment applied to the priority debt

    Returns:
        A PayoffPlan with schedule, totals, and projected payoff date.
    """
    if strategy == "snowball":
        # Smallest balance first
        ordered = sorted(debts_data, key=lambda d: d["balance"])
    else:
        # Highest interest rate first
        ordered = sorted(debts_data, key=lambda d: d["interest_rate"], reverse=True)

    # Working state for each debt
    working = []
    for d in ordered:
        working.append({
            "id": d["id"],
            "name": d["name"],
            "balance": d["balance"],
            "interest_rate": d["interest_rate"],
            "minimum_payment": d["minimum_payment"],
            "paid_off": False,
        })

    schedule: List[PayoffScheduleMonth] = []
    total_interest = 0.0
    total_paid = 0.0
    month = 0
    max_months = 360

    while any(not w["paid_off"] for w in working) and month < max_months:
        month += 1

        # Calculate freed-up minimums from paid-off debts (snowball/avalanche rollover)
        freed_minimum = sum(
            w["minimum_payment"] for w in working if w["paid_off"]
        )

        # Determine total extra available this month (original extra + rolled-over minimums)
        available_extra = extra_payment + freed_minimum

        for w in working:
            if w["paid_off"]:
                continue

            # Monthly interest
            monthly_rate = w["interest_rate"] / 100.0 / 12.0
            interest_charge = w["balance"] * monthly_rate

            # Determine payment for this debt
            # The first non-paid-off debt in the ordered list gets the extra payment
            is_priority = w is next(
                (x for x in working if not x["paid_off"]), None
            )

            if is_priority:
                payment = w["minimum_payment"] + available_extra
            else:
                payment = w["minimum_payment"]

            # Don't overpay: cap payment at balance + interest
            payment = min(payment, w["balance"] + interest_charge)

            principal = payment - interest_charge
            w["balance"] -= principal

            # Handle floating-point dust
            if w["balance"] < 0.01:
                # Adjust the final payment so we don't overshoot
                if w["balance"] < 0:
                    payment += w["balance"]  # reduce payment by the negative overshoot
                    principal += w["balance"]
                w["balance"] = 0.0
                w["paid_off"] = True

            total_interest += interest_charge
            total_paid += payment

            schedule.append(PayoffScheduleMonth(
                debt_id=w["id"],
                debt_name=w["name"],
                month_number=month,
                payment=round(payment, 2),
                principal=round(principal, 2),
                interest=round(interest_charge, 2),
                remaining_balance=round(w["balance"], 2),
            ))

    today = date.today()
    payoff_date = today + timedelta(days=month * 30)

    return PayoffPlan(
        strategy=strategy,
        total_months=month,
        total_interest=round(total_interest, 2),
        total_paid=round(total_paid, 2),
        payoff_date=payoff_date,
        schedule=schedule,
    )


def compute_amortization(balance: float, interest_rate: float, minimum_payment: float) -> List[AmortizationMonth]:
    """
    Compute a full amortization schedule for a single debt assuming minimum payments only.

    Args:
        balance: Current outstanding balance.
        interest_rate: Annual percentage rate.
        minimum_payment: Fixed monthly payment amount.

    Returns:
        List of AmortizationMonth entries.
    """
    schedule: List[AmortizationMonth] = []
    remaining = balance
    month = 0
    max_months = 360

    while remaining > 0.01 and month < max_months:
        month += 1
        monthly_rate = interest_rate / 100.0 / 12.0
        interest_charge = remaining * monthly_rate
        payment = min(minimum_payment, remaining + interest_charge)
        principal = payment - interest_charge

        # If minimum payment doesn't cover interest, the debt grows (negative amortization)
        if principal < 0:
            remaining += abs(principal)
            schedule.append(AmortizationMonth(
                month_number=month,
                payment=round(payment, 2),
                principal=round(principal, 2),
                interest=round(interest_charge, 2),
                remaining_balance=round(remaining, 2),
            ))
            # Break to prevent infinite loop on negative amortization
            if month >= max_months:
                break
            continue

        remaining -= principal

        if remaining < 0.01:
            if remaining < 0:
                payment += remaining
                principal += remaining
            remaining = 0.0

        schedule.append(AmortizationMonth(
            month_number=month,
            payment=round(payment, 2),
            principal=round(principal, 2),
            interest=round(interest_charge, 2),
            remaining_balance=round(remaining, 2),
        ))

    return schedule


# ============================================================================
# CRUD Endpoints
# ============================================================================

@router.get("/", response_model=List[DebtResponse])
async def list_debts(
    profile_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    List all debts for the current user's profiles, ordered by interest rate descending.

    Optionally filter by a specific profile_id.
    """
    profile_ids = [p.id for p in current_user.profiles]

    if not profile_ids:
        return []

    query = db.query(Debt).filter(Debt.profile_id.in_(profile_ids))

    if profile_id is not None:
        if profile_id not in profile_ids:
            raise HTTPException(status_code=403, detail="Access denied to this profile")
        query = query.filter(Debt.profile_id == profile_id)

    debts = query.order_by(Debt.interest_rate.desc()).all()
    return [debt_to_response(d) for d in debts]


@router.post("/", response_model=DebtResponse, status_code=status.HTTP_201_CREATED)
async def create_debt(
    data: DebtCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Create a new debt entry.

    Validates that the profile belongs to the current user and that the
    loan_type is one of: mortgage, auto, student, personal, credit_card, other.
    """
    profile_ids = [p.id for p in current_user.profiles]

    if data.profile_id not in profile_ids:
        raise HTTPException(status_code=403, detail="Access denied to this profile")

    if data.loan_type not in VALID_LOAN_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid loan_type '{data.loan_type}'. Must be one of: {', '.join(sorted(VALID_LOAN_TYPES))}",
        )

    debt = Debt(
        profile_id=data.profile_id,
        account_id=data.account_id,
        name=data.name,
        balance=data.balance,
        interest_rate=data.interest_rate,
        minimum_payment=data.minimum_payment,
        loan_type=data.loan_type,
        start_date=data.start_date,
        original_balance=data.original_balance,
        extra_info=data.extra_info,
    )

    db.add(debt)
    db.commit()
    db.refresh(debt)
    return debt_to_response(debt)


@router.put("/{debt_id}", response_model=DebtResponse)
async def update_debt(
    debt_id: int,
    data: DebtUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Partially update a debt entry.

    Only fields included in the request body are updated. Validates ownership
    and loan_type if provided.
    """
    profile_ids = [p.id for p in current_user.profiles]

    debt = db.query(Debt).filter(
        Debt.id == debt_id,
        Debt.profile_id.in_(profile_ids),
    ).first()

    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")

    if data.loan_type is not None and data.loan_type not in VALID_LOAN_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid loan_type '{data.loan_type}'. Must be one of: {', '.join(sorted(VALID_LOAN_TYPES))}",
        )

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(debt, key, value)

    db.commit()
    db.refresh(debt)
    return debt_to_response(debt)


@router.delete("/{debt_id}")
async def delete_debt(
    debt_id: int,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Delete a debt entry. Returns a confirmation message."""
    profile_ids = [p.id for p in current_user.profiles]

    debt = db.query(Debt).filter(
        Debt.id == debt_id,
        Debt.profile_id.in_(profile_ids),
    ).first()

    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")

    db.delete(debt)
    db.commit()
    audit.log_from_request(db, request, audit.RESOURCE_DELETED, user_id=current_user.id, resource_type="debt", resource_id=str(debt_id))
    return {"message": "Debt deleted"}


# ============================================================================
# Payoff Planning Endpoints
# ============================================================================

@router.get("/payoff-plan", response_model=PayoffPlan)
async def get_payoff_plan(
    strategy: str = Query("avalanche", regex="^(snowball|avalanche)$"),
    extra_payment: float = Query(0, ge=0),
    profile_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Generate a debt payoff plan using the specified strategy.

    - **snowball**: Pay off smallest balance first, then roll that payment into
      the next smallest. Psychologically motivating due to quick wins.
    - **avalanche**: Pay off highest interest rate first, then roll that payment
      into the next highest rate. Mathematically optimal -- minimizes total interest.
    - **extra_payment**: Additional amount applied monthly to the priority debt
      on top of all minimum payments.

    Each month, minimum payments are made on all debts. The extra_payment (plus
    any freed-up minimums from paid-off debts) is applied to the priority debt.
    Capped at 360 months to prevent runaway calculations.
    """
    profile_ids = [p.id for p in current_user.profiles]

    query = db.query(Debt).filter(Debt.profile_id.in_(profile_ids))
    if profile_id is not None:
        if profile_id not in profile_ids:
            raise HTTPException(status_code=403, detail="Access denied to this profile")
        query = query.filter(Debt.profile_id == profile_id)

    debts = query.all()

    if not debts:
        raise HTTPException(status_code=404, detail="No debts found")

    debts_data = [
        {
            "id": d.id,
            "name": d.name,
            "balance": float(d.balance),
            "interest_rate": float(d.interest_rate),
            "minimum_payment": float(d.minimum_payment),
        }
        for d in debts
    ]

    plan = compute_payoff_plan(debts_data, strategy, extra_payment)
    return plan


@router.get("/comparison", response_model=StrategyComparison)
async def compare_strategies(
    extra_payment: float = Query(0, ge=0),
    profile_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Compare snowball and avalanche payoff strategies side by side.

    Returns both plans along with the difference in months and interest paid
    between the two strategies, making it easy to see which saves more.
    """
    profile_ids = [p.id for p in current_user.profiles]

    query = db.query(Debt).filter(Debt.profile_id.in_(profile_ids))
    if profile_id is not None:
        if profile_id not in profile_ids:
            raise HTTPException(status_code=403, detail="Access denied to this profile")
        query = query.filter(Debt.profile_id == profile_id)

    debts = query.all()

    if not debts:
        raise HTTPException(status_code=404, detail="No debts found")

    debts_data = [
        {
            "id": d.id,
            "name": d.name,
            "balance": float(d.balance),
            "interest_rate": float(d.interest_rate),
            "minimum_payment": float(d.minimum_payment),
        }
        for d in debts
    ]

    snowball_plan = compute_payoff_plan(debts_data, "snowball", extra_payment)
    avalanche_plan = compute_payoff_plan(debts_data, "avalanche", extra_payment)

    months_saved = snowball_plan.total_months - avalanche_plan.total_months
    interest_saved = round(snowball_plan.total_interest - avalanche_plan.total_interest, 2)

    return StrategyComparison(
        snowball=snowball_plan,
        avalanche=avalanche_plan,
        months_saved=months_saved,
        interest_saved=interest_saved,
    )


@router.get("/total-interest", response_model=TotalInterestSummary)
async def get_total_interest(
    profile_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Calculate aggregate interest statistics across all debts.

    Returns the total balance, total minimum payments per month, total interest
    that would be paid if only minimums are made, and estimated months to pay off
    all debts at minimum payments.
    """
    profile_ids = [p.id for p in current_user.profiles]

    query = db.query(Debt).filter(Debt.profile_id.in_(profile_ids))
    if profile_id is not None:
        if profile_id not in profile_ids:
            raise HTTPException(status_code=403, detail="Access denied to this profile")
        query = query.filter(Debt.profile_id == profile_id)

    debts = query.all()

    if not debts:
        return TotalInterestSummary(
            total_balance=0,
            total_minimum_payments=0,
            total_interest_if_minimum_only=0,
            estimated_payoff_months=0,
        )

    total_balance = sum(float(d.balance) for d in debts)
    total_minimum_payments = sum(float(d.minimum_payment) for d in debts)

    # Simulate minimum-only payments across all debts independently
    total_interest = 0.0
    max_months = 0

    for d in debts:
        amort = compute_amortization(
            float(d.balance), float(d.interest_rate), float(d.minimum_payment)
        )
        debt_interest = sum(m.interest for m in amort)
        total_interest += debt_interest
        if amort:
            max_months = max(max_months, amort[-1].month_number)

    return TotalInterestSummary(
        total_balance=round(total_balance, 2),
        total_minimum_payments=round(total_minimum_payments, 2),
        total_interest_if_minimum_only=round(total_interest, 2),
        estimated_payoff_months=max_months,
    )


# ============================================================================
# Amortization Endpoint
# ============================================================================

@router.get("/{debt_id}/amortization", response_model=List[AmortizationMonth])
async def get_amortization_schedule(
    debt_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Generate a full amortization table for a single debt assuming minimum payments only.

    Each row shows the month number, payment amount, how much goes to principal,
    how much goes to interest, and the remaining balance. Capped at 360 months.
    """
    profile_ids = [p.id for p in current_user.profiles]

    debt = db.query(Debt).filter(
        Debt.id == debt_id,
        Debt.profile_id.in_(profile_ids),
    ).first()

    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")

    schedule = compute_amortization(
        float(debt.balance), float(debt.interest_rate), float(debt.minimum_payment)
    )

    return schedule


# ============================================================================
# Unified Debt + Credit Dashboard
# ============================================================================

class DebtCreditDashboard(BaseModel):
    """Unified dashboard showing debt payoff status and credit health."""
    # Debt summary
    total_debt: float
    debt_count: int
    total_minimum_payment: float
    debts: List[DebtResponse]

    # Credit health
    credit_score: Optional[int] = None
    credit_score_date: Optional[str] = None
    credit_utilization: float
    debt_to_income_ratio: float
    health_score: int
    health_rating: str

    # Payoff projections with credit impact
    payoff_plan_snowball: Optional[Dict] = None
    payoff_plan_avalanche: Optional[Dict] = None
    credit_projection: Optional[Dict] = None


@router.get("/dashboard", response_model=DebtCreditDashboard)
async def get_debt_credit_dashboard(
    extra_payment: float = Query(0, ge=0, description="Extra monthly payment to apply"),
    strategy: str = Query("avalanche", description="Payoff strategy: snowball or avalanche"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get unified dashboard showing debt payoff status and credit health.

    This endpoint combines:
    - All debts with total balance and minimum payments
    - Credit health metrics (score, utilization, DTI)
    - Payoff plan projections (snowball and avalanche)
    - Credit score projection based on debt payoff

    Query params:
    - extra_payment: Additional monthly payment beyond minimums (default: 0)
    - strategy: Preferred strategy for detailed plan (default: avalanche)
    """
    # Get user's profiles
    profile_ids = [p.id for p in current_user.profiles]

    if not profile_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No profiles found for user"
        )

    # Get all debts
    debts = db.query(Debt).filter(
        Debt.profile_id.in_(profile_ids)
    ).order_by(Debt.balance.desc()).all()

    total_debt = sum(float(d.balance) for d in debts)
    total_minimum_payment = sum(float(d.minimum_payment) for d in debts)
    debt_responses = [debt_to_response(d) for d in debts]

    # Get credit health metrics
    credit_service = CreditHealthService(db)
    health_metrics = credit_service.get_credit_health_snapshot(
        user_id=current_user.id,
        profile_ids=profile_ids
    )

    # Generate payoff plans if there are debts
    snowball_plan = None
    avalanche_plan = None
    credit_projection = None

    if debts:
        debts_data = [
            {
                "id": d.id,
                "name": d.name,
                "balance": float(d.balance),
                "interest_rate": float(d.interest_rate),
                "minimum_payment": float(d.minimum_payment),
            }
            for d in debts
        ]

        # Compute both strategies
        snowball_plan = compute_payoff_plan(debts_data, "snowball", extra_payment)
        avalanche_plan = compute_payoff_plan(debts_data, "avalanche", extra_payment)

        # Convert to dict for response
        snowball_dict = {
            "strategy": snowball_plan.strategy,
            "total_months": snowball_plan.total_months,
            "total_interest": snowball_plan.total_interest,
            "total_paid": snowball_plan.total_paid,
            "payoff_date": snowball_plan.payoff_date.isoformat(),
        }

        avalanche_dict = {
            "strategy": avalanche_plan.strategy,
            "total_months": avalanche_plan.total_months,
            "total_interest": avalanche_plan.total_interest,
            "total_paid": avalanche_plan.total_paid,
            "payoff_date": avalanche_plan.payoff_date.isoformat(),
        }

        # Generate credit score projection based on selected strategy
        # Map debt_id to extra payment (evenly distributed for simplicity)
        payoff_scenario = {}
        if extra_payment > 0:
            # Apply extra payment to priority debt based on strategy
            selected_plan = avalanche_plan if strategy == "avalanche" else snowball_plan
            if selected_plan.schedule:
                # Find first debt that gets extra payment
                first_debt_id = selected_plan.schedule[0].debt_id
                payoff_scenario[first_debt_id] = extra_payment

        projection = credit_service.project_credit_score(
            user_id=current_user.id,
            profile_ids=profile_ids,
            payoff_scenario=payoff_scenario
        )

        credit_projection = {
            "current_score": projection["current_score"],
            "current_utilization": projection["current_utilization"],
            "current_dti": projection["current_dti"],
            "projections": projection["projections"],
            "total_months": projection["total_months"],
        }

    return DebtCreditDashboard(
        total_debt=round(total_debt, 2),
        debt_count=len(debts),
        total_minimum_payment=round(total_minimum_payment, 2),
        debts=debt_responses,
        credit_score=health_metrics["credit_score"],
        credit_score_date=health_metrics["credit_score_date"],
        credit_utilization=health_metrics["credit_utilization"],
        debt_to_income_ratio=health_metrics["debt_to_income_ratio"],
        health_score=health_metrics["health_score"],
        health_rating=health_metrics["health_rating"],
        payoff_plan_snowball=snowball_dict if snowball_plan else None,
        payoff_plan_avalanche=avalanche_dict if avalanche_plan else None,
        credit_projection=credit_projection,
    )
