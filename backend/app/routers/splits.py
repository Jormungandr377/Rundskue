"""Bill splitting router - split expenses among participants."""
import logging
from datetime import datetime, date, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from pydantic import BaseModel, Field

from ..database import get_db
from ..models import SplitExpense, SplitParticipant, User
from ..dependencies import get_current_active_user
from ..services import audit

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================================
# Schemas
# ============================================================================

class ParticipantCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: Optional[str] = Field(None, max_length=255)
    share_amount: float = Field(..., gt=0)


class ParticipantResponse(BaseModel):
    id: int
    split_expense_id: int
    profile_id: Optional[int]
    name: str
    email: Optional[str]
    share_amount: float
    is_paid: bool
    paid_at: Optional[datetime]

    class Config:
        from_attributes = True


class SplitExpenseCreate(BaseModel):
    profile_id: int
    transaction_id: Optional[int] = None
    description: str = Field(..., min_length=1, max_length=255)
    total_amount: float = Field(..., gt=0)
    date: date
    participants: List[ParticipantCreate]


class SplitExpenseUpdate(BaseModel):
    description: Optional[str] = Field(None, min_length=1, max_length=255)
    date: Optional[date] = None


class SplitExpenseResponse(BaseModel):
    id: int
    profile_id: int
    transaction_id: Optional[int]
    description: str
    total_amount: float
    date: date
    created_at: datetime
    participants: List[ParticipantResponse]

    class Config:
        from_attributes = True


class BalanceSummary(BaseModel):
    name: str
    email: Optional[str]
    total_owed: float
    total_paid: float
    net_balance: float


class SplitEquallyCreate(BaseModel):
    profile_id: int
    description: str = Field(..., min_length=1, max_length=255)
    total_amount: float = Field(..., gt=0)
    date: date
    participant_names: List[str] = Field(..., min_length=1)


# ============================================================================
# Helpers
# ============================================================================

def _split_expense_to_response(expense: SplitExpense) -> SplitExpenseResponse:
    """Convert a SplitExpense ORM object to a response schema."""
    return SplitExpenseResponse(
        id=expense.id,
        profile_id=expense.profile_id,
        transaction_id=expense.transaction_id,
        description=expense.description,
        total_amount=float(expense.total_amount),
        date=expense.date,
        created_at=expense.created_at,
        participants=[
            ParticipantResponse(
                id=p.id,
                split_expense_id=p.split_expense_id,
                profile_id=p.profile_id,
                name=p.name,
                email=p.email,
                share_amount=float(p.share_amount),
                is_paid=p.is_paid,
                paid_at=p.paid_at,
            )
            for p in expense.participants
        ],
    )


# ============================================================================
# CRUD Endpoints
# ============================================================================

@router.get("/", response_model=List[SplitExpenseResponse])
def list_split_expenses(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """List all split expenses for the current user, ordered by date descending."""
    profile_ids = [p.id for p in current_user.profiles]

    expenses = (
        db.query(SplitExpense)
        .options(joinedload(SplitExpense.participants))
        .filter(SplitExpense.profile_id.in_(profile_ids))
        .order_by(SplitExpense.date.desc())
        .all()
    )

    return [_split_expense_to_response(e) for e in expenses]


@router.post("/", response_model=SplitExpenseResponse, status_code=status.HTTP_201_CREATED)
def create_split_expense(
    data: SplitExpenseCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Create a new split expense with participants.

    Validates that the sum of participant shares equals the total amount.
    """
    profile_ids = [p.id for p in current_user.profiles]
    if data.profile_id not in profile_ids:
        raise HTTPException(status_code=403, detail="Access denied to this profile")

    if not data.participants:
        raise HTTPException(
            status_code=400,
            detail="At least one participant is required",
        )

    # Validate that shares sum to total_amount (allow rounding tolerance of 1 cent)
    shares_sum = sum(p.share_amount for p in data.participants)
    if abs(shares_sum - data.total_amount) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Sum of participant shares ({shares_sum:.2f}) does not equal total amount ({data.total_amount:.2f})",
        )

    expense = SplitExpense(
        profile_id=data.profile_id,
        transaction_id=data.transaction_id,
        description=data.description,
        total_amount=data.total_amount,
        date=data.date,
    )
    db.add(expense)
    db.flush()

    for participant in data.participants:
        db_participant = SplitParticipant(
            split_expense_id=expense.id,
            name=participant.name,
            email=participant.email,
            share_amount=participant.share_amount,
        )
        db.add(db_participant)

    db.commit()
    db.refresh(expense)
    return _split_expense_to_response(expense)


@router.put("/{split_id}", response_model=SplitExpenseResponse)
def update_split_expense(
    split_id: int,
    data: SplitExpenseUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Update a split expense's description and/or date."""
    profile_ids = [p.id for p in current_user.profiles]

    expense = (
        db.query(SplitExpense)
        .options(joinedload(SplitExpense.participants))
        .filter(
            SplitExpense.id == split_id,
            SplitExpense.profile_id.in_(profile_ids),
        )
        .first()
    )
    if not expense:
        raise HTTPException(status_code=404, detail="Split expense not found")

    if data.description is not None:
        expense.description = data.description
    if data.date is not None:
        expense.date = data.date

    db.commit()
    db.refresh(expense)
    return _split_expense_to_response(expense)


@router.delete("/{split_id}")
def delete_split_expense(
    split_id: int,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Delete a split expense and all its participants (cascade)."""
    profile_ids = [p.id for p in current_user.profiles]

    expense = db.query(SplitExpense).filter(
        SplitExpense.id == split_id,
        SplitExpense.profile_id.in_(profile_ids),
    ).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Split expense not found")

    db.delete(expense)
    db.commit()
    audit.log_from_request(db, request, audit.RESOURCE_DELETED, user_id=current_user.id, resource_type="split_expense", resource_id=str(split_id))
    return {"message": "Split expense deleted"}


# ============================================================================
# Mark as Paid
# ============================================================================

@router.put("/{split_id}/participants/{participant_id}/paid", response_model=ParticipantResponse)
def toggle_participant_paid(
    split_id: int,
    participant_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Toggle a participant's paid status. Sets paid_at when marking as paid."""
    profile_ids = [p.id for p in current_user.profiles]

    # Verify the split expense belongs to the user
    expense = db.query(SplitExpense).filter(
        SplitExpense.id == split_id,
        SplitExpense.profile_id.in_(profile_ids),
    ).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Split expense not found")

    participant = db.query(SplitParticipant).filter(
        SplitParticipant.id == participant_id,
        SplitParticipant.split_expense_id == split_id,
    ).first()
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")

    # Toggle is_paid and set/clear paid_at
    participant.is_paid = not participant.is_paid
    participant.paid_at = datetime.now(timezone.utc) if participant.is_paid else None

    db.commit()
    db.refresh(participant)

    return ParticipantResponse(
        id=participant.id,
        split_expense_id=participant.split_expense_id,
        profile_id=participant.profile_id,
        name=participant.name,
        email=participant.email,
        share_amount=float(participant.share_amount),
        is_paid=participant.is_paid,
        paid_at=participant.paid_at,
    )


# ============================================================================
# Balances
# ============================================================================

@router.get("/balances", response_model=List[BalanceSummary])
def get_balances(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Calculate net balance for each participant across all split expenses.

    Returns the total owed, total paid, and net balance for each unique
    participant name. A positive net_balance means the participant still
    owes money; zero means they are settled up.
    """
    profile_ids = [p.id for p in current_user.profiles]

    # Get all participants across user's split expenses
    participants = (
        db.query(SplitParticipant)
        .join(SplitExpense)
        .filter(SplitExpense.profile_id.in_(profile_ids))
        .all()
    )

    # Aggregate by participant name (case-insensitive grouping)
    balances: dict[str, dict] = {}
    for p in participants:
        key = p.name.strip().lower()
        if key not in balances:
            balances[key] = {
                "name": p.name.strip(),
                "email": p.email,
                "total_owed": 0.0,
                "total_paid": 0.0,
            }
        # Keep the most recent non-null email
        if p.email and not balances[key]["email"]:
            balances[key]["email"] = p.email

        share = float(p.share_amount)
        balances[key]["total_owed"] += share
        if p.is_paid:
            balances[key]["total_paid"] += share

    result = []
    for data in balances.values():
        net_balance = round(data["total_owed"] - data["total_paid"], 2)
        result.append(
            BalanceSummary(
                name=data["name"],
                email=data["email"],
                total_owed=round(data["total_owed"], 2),
                total_paid=round(data["total_paid"], 2),
                net_balance=net_balance,
            )
        )

    # Sort by net_balance descending (highest debt first)
    result.sort(key=lambda b: b.net_balance, reverse=True)
    return result


# ============================================================================
# Split Equally
# ============================================================================

@router.post("/split-equally", response_model=SplitExpenseResponse, status_code=status.HTTP_201_CREATED)
def split_equally(
    data: SplitEquallyCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Create a split expense divided equally among participants.

    The total amount is divided evenly. Any remainder from rounding is
    added to the first participant's share so the shares always sum
    exactly to the total.
    """
    profile_ids = [p.id for p in current_user.profiles]
    if data.profile_id not in profile_ids:
        raise HTTPException(status_code=403, detail="Access denied to this profile")

    if not data.participant_names:
        raise HTTPException(
            status_code=400,
            detail="At least one participant name is required",
        )

    # Deduplicate names while preserving order
    seen: set[str] = set()
    unique_names: list[str] = []
    for name in data.participant_names:
        stripped = name.strip()
        if not stripped:
            continue
        lower = stripped.lower()
        if lower not in seen:
            seen.add(lower)
            unique_names.append(stripped)

    if not unique_names:
        raise HTTPException(
            status_code=400,
            detail="At least one non-empty participant name is required",
        )

    num_participants = len(unique_names)
    total = Decimal(str(data.total_amount))

    # Calculate equal share rounded to 2 decimal places
    base_share = (total / num_participants).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    remainder = total - (base_share * num_participants)

    expense = SplitExpense(
        profile_id=data.profile_id,
        description=data.description,
        total_amount=data.total_amount,
        date=data.date,
    )
    db.add(expense)
    db.flush()

    for i, name in enumerate(unique_names):
        share = base_share + remainder if i == 0 else base_share
        db_participant = SplitParticipant(
            split_expense_id=expense.id,
            name=name,
            share_amount=float(share),
        )
        db.add(db_participant)

    db.commit()
    db.refresh(expense)
    return _split_expense_to_response(expense)
