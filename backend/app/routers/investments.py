"""Investments API router - portfolio tracking, asset allocation, and dividends."""
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, extract
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import InvestmentHolding, Account, Transaction, User
from ..dependencies import get_current_active_user
from ..services import audit

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class HoldingCreate(BaseModel):
    account_id: int
    symbol: str = Field(..., max_length=20)
    name: Optional[str] = Field(None, max_length=255)
    quantity: Decimal = Field(..., decimal_places=6)
    price: Decimal = Field(..., decimal_places=4)
    value: Decimal = Field(..., decimal_places=2)
    cost_basis: Optional[Decimal] = None
    gain_loss: Optional[Decimal] = None
    asset_class: Optional[str] = Field("stocks", max_length=30)


class HoldingUpdate(BaseModel):
    symbol: Optional[str] = Field(None, max_length=20)
    name: Optional[str] = Field(None, max_length=255)
    quantity: Optional[Decimal] = None
    price: Optional[Decimal] = None
    value: Optional[Decimal] = None
    cost_basis: Optional[Decimal] = None
    gain_loss: Optional[Decimal] = None
    asset_class: Optional[str] = Field(None, max_length=30)


class HoldingResponse(BaseModel):
    id: int
    account_id: int
    account_name: str
    symbol: str
    name: Optional[str]
    quantity: float
    price: float
    value: float
    cost_basis: Optional[float]
    gain_loss: Optional[float]
    asset_class: str
    last_updated: Optional[datetime]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class AssetAllocation(BaseModel):
    asset_class: str
    total_value: float
    percentage: float
    holding_count: int


class DividendMonth(BaseModel):
    year: int
    month: int
    total: float


class DividendSummary(BaseModel):
    monthly: List[DividendMonth]
    grand_total: float


class PortfolioSummary(BaseModel):
    total_value: float
    total_cost_basis: float
    total_gain_loss: float
    gain_loss_percentage: float
    number_of_holdings: int


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_user_profile_ids(current_user: User) -> list[int]:
    """Return the list of profile IDs belonging to the current user."""
    return [p.id for p in current_user.profiles]


def _get_user_account_ids(db: Session, profile_ids: list[int]) -> list[int]:
    """Return account IDs that belong to the given profiles."""
    rows = (
        db.query(Account.id)
        .filter(Account.profile_id.in_(profile_ids))
        .all()
    )
    return [r[0] for r in rows]


def _verify_account_ownership(
    db: Session, account_id: int, profile_ids: list[int]
) -> Account:
    """
    Verify that the account belongs to one of the user's profiles.
    Returns the Account or raises 404.
    """
    account = (
        db.query(Account)
        .filter(Account.id == account_id, Account.profile_id.in_(profile_ids))
        .first()
    )
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


def _holding_to_response(holding: InvestmentHolding) -> HoldingResponse:
    """Convert an InvestmentHolding ORM instance to a response schema."""
    account_name = holding.account.display_name or holding.account.name
    return HoldingResponse(
        id=holding.id,
        account_id=holding.account_id,
        account_name=account_name,
        symbol=holding.symbol,
        name=holding.name,
        quantity=float(holding.quantity),
        price=float(holding.price),
        value=float(holding.value),
        cost_basis=float(holding.cost_basis) if holding.cost_basis is not None else None,
        gain_loss=float(holding.gain_loss) if holding.gain_loss is not None else None,
        asset_class=holding.asset_class or "stocks",
        last_updated=holding.last_updated,
        created_at=holding.created_at,
    )


# ---------------------------------------------------------------------------
# CRUD Endpoints
# ---------------------------------------------------------------------------

@router.get("/holdings", response_model=List[HoldingResponse])
def list_holdings(
    account_id: Optional[int] = Query(None, description="Filter by account ID"),
    asset_class: Optional[str] = Query(None, description="Filter by asset class"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """List all investment holdings for the current user's accounts."""
    profile_ids = _get_user_profile_ids(current_user)

    query = (
        db.query(InvestmentHolding)
        .join(Account, InvestmentHolding.account_id == Account.id)
        .filter(Account.profile_id.in_(profile_ids))
    )

    if account_id is not None:
        _verify_account_ownership(db, account_id, profile_ids)
        query = query.filter(InvestmentHolding.account_id == account_id)

    if asset_class is not None:
        query = query.filter(InvestmentHolding.asset_class == asset_class)

    holdings = query.order_by(InvestmentHolding.value.desc()).all()
    return [_holding_to_response(h) for h in holdings]


@router.post("/holdings", response_model=HoldingResponse, status_code=201)
def create_holding(
    data: HoldingCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Create a new investment holding."""
    profile_ids = _get_user_profile_ids(current_user)
    _verify_account_ownership(db, data.account_id, profile_ids)

    holding = InvestmentHolding(
        account_id=data.account_id,
        symbol=data.symbol.upper(),
        name=data.name,
        quantity=data.quantity,
        price=data.price,
        value=data.value,
        cost_basis=data.cost_basis,
        gain_loss=data.gain_loss,
        asset_class=data.asset_class or "stocks",
    )
    db.add(holding)
    db.commit()
    db.refresh(holding)
    return _holding_to_response(holding)


@router.put("/holdings/{holding_id}", response_model=HoldingResponse)
def update_holding(
    holding_id: int,
    data: HoldingUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Update an existing investment holding."""
    profile_ids = _get_user_profile_ids(current_user)

    holding = (
        db.query(InvestmentHolding)
        .join(Account, InvestmentHolding.account_id == Account.id)
        .filter(
            InvestmentHolding.id == holding_id,
            Account.profile_id.in_(profile_ids),
        )
        .first()
    )
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")

    update_fields = data.dict(exclude_unset=True)
    for field, value in update_fields.items():
        if field == "symbol" and value is not None:
            value = value.upper()
        setattr(holding, field, value)

    holding.last_updated = datetime.now(timezone.utc)
    db.commit()
    db.refresh(holding)
    return _holding_to_response(holding)


@router.delete("/holdings/{holding_id}", status_code=204)
def delete_holding(
    holding_id: int,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Delete an investment holding."""
    profile_ids = _get_user_profile_ids(current_user)

    holding = (
        db.query(InvestmentHolding)
        .join(Account, InvestmentHolding.account_id == Account.id)
        .filter(
            InvestmentHolding.id == holding_id,
            Account.profile_id.in_(profile_ids),
        )
        .first()
    )
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")

    db.delete(holding)
    db.commit()
    audit.log_from_request(db, request, audit.RESOURCE_DELETED, user_id=current_user.id, resource_type="investment_holding", resource_id=str(holding_id))
    return None


# ---------------------------------------------------------------------------
# Asset Allocation
# ---------------------------------------------------------------------------

@router.get("/allocation", response_model=List[AssetAllocation])
def get_asset_allocation(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get asset allocation grouped by asset_class.

    Returns each asset class with its total value, percentage of the whole
    portfolio, and the number of holdings in that class.
    """
    profile_ids = _get_user_profile_ids(current_user)

    rows = (
        db.query(
            InvestmentHolding.asset_class,
            func.sum(InvestmentHolding.value).label("total_value"),
            func.count(InvestmentHolding.id).label("holding_count"),
        )
        .join(Account, InvestmentHolding.account_id == Account.id)
        .filter(Account.profile_id.in_(profile_ids))
        .group_by(InvestmentHolding.asset_class)
        .all()
    )

    portfolio_total = sum(float(r.total_value or 0) for r in rows)

    result: list[AssetAllocation] = []
    for row in rows:
        total = float(row.total_value or 0)
        pct = (total / portfolio_total * 100) if portfolio_total > 0 else 0.0
        result.append(
            AssetAllocation(
                asset_class=row.asset_class or "other",
                total_value=round(total, 2),
                percentage=round(pct, 2),
                holding_count=row.holding_count,
            )
        )

    result.sort(key=lambda a: a.total_value, reverse=True)
    return result


# ---------------------------------------------------------------------------
# Dividends
# ---------------------------------------------------------------------------

@router.get("/dividends", response_model=DividendSummary)
def get_dividends(
    year: Optional[int] = Query(None, description="Filter by year"),
    account_id: Optional[int] = Query(None, description="Filter by account ID"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get dividend income grouped by month.

    Queries transactions where is_dividend=True for the user's accounts.
    Returns monthly totals and a grand total.  Optionally filter by year
    and/or account_id.
    """
    profile_ids = _get_user_profile_ids(current_user)

    query = (
        db.query(
            extract("year", Transaction.date).label("year"),
            extract("month", Transaction.date).label("month"),
            func.sum(Transaction.amount).label("total"),
        )
        .join(Account, Transaction.account_id == Account.id)
        .filter(
            Account.profile_id.in_(profile_ids),
            Transaction.is_dividend == True,  # noqa: E712
        )
    )

    if year is not None:
        query = query.filter(extract("year", Transaction.date) == year)

    if account_id is not None:
        _verify_account_ownership(db, account_id, profile_ids)
        query = query.filter(Transaction.account_id == account_id)

    rows = (
        query
        .group_by("year", "month")
        .order_by("year", "month")
        .all()
    )

    monthly = [
        DividendMonth(
            year=int(r.year),
            month=int(r.month),
            # Dividends are income so amount is typically negative in Plaid
            # convention (negative = income). Return absolute value for clarity.
            total=round(abs(float(r.total or 0)), 2),
        )
        for r in rows
    ]

    grand_total = round(sum(m.total for m in monthly), 2)

    return DividendSummary(monthly=monthly, grand_total=grand_total)


# ---------------------------------------------------------------------------
# Portfolio Summary
# ---------------------------------------------------------------------------

@router.get("/summary", response_model=PortfolioSummary)
def get_portfolio_summary(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get a high-level portfolio summary.

    Returns total portfolio value, total cost basis, total gain/loss,
    gain/loss percentage, and number of holdings.
    """
    profile_ids = _get_user_profile_ids(current_user)

    row = (
        db.query(
            func.coalesce(func.sum(InvestmentHolding.value), 0).label("total_value"),
            func.coalesce(func.sum(InvestmentHolding.cost_basis), 0).label("total_cost_basis"),
            func.coalesce(func.sum(InvestmentHolding.gain_loss), 0).label("total_gain_loss"),
            func.count(InvestmentHolding.id).label("count"),
        )
        .join(Account, InvestmentHolding.account_id == Account.id)
        .filter(Account.profile_id.in_(profile_ids))
        .one()
    )

    total_value = float(row.total_value)
    total_cost_basis = float(row.total_cost_basis)
    total_gain_loss = float(row.total_gain_loss)
    count = row.count

    if total_cost_basis > 0:
        gain_loss_pct = round(total_gain_loss / total_cost_basis * 100, 2)
    else:
        gain_loss_pct = 0.0

    return PortfolioSummary(
        total_value=round(total_value, 2),
        total_cost_basis=round(total_cost_basis, 2),
        total_gain_loss=round(total_gain_loss, 2),
        gain_loss_percentage=gain_loss_pct,
        number_of_holdings=count,
    )
