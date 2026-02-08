"""Envelopes router - zero-based envelope budgeting."""
import logging
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from ..database import get_db
from ..models import Envelope, Transaction, Account, User
from ..dependencies import get_current_active_user
from ..services import audit

logger = logging.getLogger(__name__)
router = APIRouter()


# Schemas
class EnvelopeCreate(BaseModel):
    profile_id: int
    name: str
    allocated_amount: float = 0
    color: str = "#3b82f6"
    icon: str = "wallet"


class EnvelopeUpdate(BaseModel):
    name: Optional[str] = None
    allocated_amount: Optional[float] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    is_active: Optional[bool] = None


class EnvelopeResponse(BaseModel):
    id: int
    profile_id: int
    name: str
    allocated_amount: float
    spent_amount: float
    remaining_amount: float
    color: str
    icon: str
    is_active: bool
    transaction_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class EnvelopeSummary(BaseModel):
    total_allocated: float
    total_spent: float
    total_remaining: float
    unallocated_income: float
    envelope_count: int


def _get_envelope_spent(db: Session, envelope_id: int) -> tuple[float, int]:
    """Get total spent and transaction count for an envelope."""
    result = db.query(
        func.coalesce(func.sum(Transaction.amount), 0).label("total"),
        func.count(Transaction.id).label("cnt"),
    ).filter(
        Transaction.envelope_id == envelope_id,
        Transaction.amount > 0,
        Transaction.is_excluded == False,
        Transaction.is_transfer == False,
    ).first()
    return float(result.total), int(result.cnt)


@router.get("/", response_model=List[EnvelopeResponse])
def list_envelopes(
    profile_id: int,
    active_only: bool = True,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """List envelopes for a profile."""
    profile_ids = [p.id for p in current_user.profiles]
    if profile_id not in profile_ids:
        raise HTTPException(status_code=403, detail="Access denied to this profile")

    query = db.query(Envelope).filter(Envelope.profile_id == profile_id)
    if active_only:
        query = query.filter(Envelope.is_active == True)

    envelopes = query.order_by(Envelope.name).all()

    result = []
    for env in envelopes:
        spent, count = _get_envelope_spent(db, env.id)
        allocated = float(env.allocated_amount)
        result.append(EnvelopeResponse(
            id=env.id,
            profile_id=env.profile_id,
            name=env.name,
            allocated_amount=allocated,
            spent_amount=spent,
            remaining_amount=allocated - spent,
            color=env.color or "#3b82f6",
            icon=env.icon or "wallet",
            is_active=env.is_active,
            transaction_count=count,
            created_at=env.created_at,
        ))
    return result


@router.get("/summary", response_model=EnvelopeSummary)
def get_envelope_summary(
    profile_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get summary of all envelopes for a profile."""
    profile_ids = [p.id for p in current_user.profiles]
    if profile_id not in profile_ids:
        raise HTTPException(status_code=403, detail="Access denied to this profile")

    envelopes = db.query(Envelope).filter(
        Envelope.profile_id == profile_id,
        Envelope.is_active == True,
    ).all()

    total_allocated = 0.0
    total_spent = 0.0

    for env in envelopes:
        spent, _ = _get_envelope_spent(db, env.id)
        total_allocated += float(env.allocated_amount)
        total_spent += spent

    # Calculate unallocated: total income that hasn't been assigned to envelopes
    # Get total income transactions for this profile (negative amounts = income in Plaid)
    total_income = db.query(
        func.coalesce(func.sum(func.abs(Transaction.amount)), 0)
    ).join(
        Account, Transaction.account_id == Account.id
    ).filter(
        Account.profile_id == profile_id,
        Transaction.amount < 0,  # Income is negative in Plaid
        Transaction.is_excluded == False,
        Transaction.is_transfer == False,
    ).scalar() or 0.0

    unallocated_income = float(total_income) - total_allocated

    return EnvelopeSummary(
        total_allocated=total_allocated,
        total_spent=total_spent,
        total_remaining=total_allocated - total_spent,
        unallocated_income=unallocated_income,
        envelope_count=len(envelopes),
    )


@router.post("/", response_model=EnvelopeResponse)
def create_envelope(
    data: EnvelopeCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Create a new envelope."""
    profile_ids = [p.id for p in current_user.profiles]
    if data.profile_id not in profile_ids:
        raise HTTPException(status_code=403, detail="Access denied to this profile")

    envelope = Envelope(
        profile_id=data.profile_id,
        name=data.name,
        allocated_amount=data.allocated_amount,
        color=data.color,
        icon=data.icon,
    )
    db.add(envelope)
    db.commit()
    db.refresh(envelope)

    return EnvelopeResponse(
        id=envelope.id,
        profile_id=envelope.profile_id,
        name=envelope.name,
        allocated_amount=float(envelope.allocated_amount),
        spent_amount=0,
        remaining_amount=float(envelope.allocated_amount),
        color=envelope.color or "#3b82f6",
        icon=envelope.icon or "wallet",
        is_active=envelope.is_active,
        transaction_count=0,
        created_at=envelope.created_at,
    )


@router.put("/{envelope_id}", response_model=EnvelopeResponse)
def update_envelope(
    envelope_id: int,
    data: EnvelopeUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Update an envelope."""
    profile_ids = [p.id for p in current_user.profiles]
    envelope = db.query(Envelope).filter(
        Envelope.id == envelope_id,
        Envelope.profile_id.in_(profile_ids),
    ).first()
    if not envelope:
        raise HTTPException(status_code=404, detail="Envelope not found")

    if data.name is not None:
        envelope.name = data.name
    if data.allocated_amount is not None:
        envelope.allocated_amount = data.allocated_amount
    if data.color is not None:
        envelope.color = data.color
    if data.icon is not None:
        envelope.icon = data.icon
    if data.is_active is not None:
        envelope.is_active = data.is_active

    db.commit()
    db.refresh(envelope)

    spent, count = _get_envelope_spent(db, envelope.id)
    allocated = float(envelope.allocated_amount)
    return EnvelopeResponse(
        id=envelope.id,
        profile_id=envelope.profile_id,
        name=envelope.name,
        allocated_amount=allocated,
        spent_amount=spent,
        remaining_amount=allocated - spent,
        color=envelope.color or "#3b82f6",
        icon=envelope.icon or "wallet",
        is_active=envelope.is_active,
        transaction_count=count,
        created_at=envelope.created_at,
    )


@router.delete("/{envelope_id}")
def delete_envelope(
    envelope_id: int,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Delete an envelope (unlinks transactions)."""
    profile_ids = [p.id for p in current_user.profiles]
    envelope = db.query(Envelope).filter(
        Envelope.id == envelope_id,
        Envelope.profile_id.in_(profile_ids),
    ).first()
    if not envelope:
        raise HTTPException(status_code=404, detail="Envelope not found")

    # Unlink transactions
    db.query(Transaction).filter(Transaction.envelope_id == envelope_id).update(
        {"envelope_id": None}
    )
    db.delete(envelope)
    db.commit()
    audit.log_from_request(db, request, audit.RESOURCE_DELETED, user_id=current_user.id, resource_type="envelope", resource_id=str(envelope_id))
    return {"message": "Envelope deleted"}


@router.post("/{envelope_id}/assign")
def assign_transactions(
    envelope_id: int,
    transaction_ids: List[int],
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Assign transactions to an envelope."""
    profile_ids = [p.id for p in current_user.profiles]
    envelope = db.query(Envelope).filter(
        Envelope.id == envelope_id,
        Envelope.profile_id.in_(profile_ids),
    ).first()
    if not envelope:
        raise HTTPException(status_code=404, detail="Envelope not found")

    updated = db.query(Transaction).filter(
        Transaction.id.in_(transaction_ids),
        Transaction.account_id.in_(
            db.query(Account.id).filter(Account.profile_id.in_(profile_ids))
        ),
    ).update({"envelope_id": envelope_id}, synchronize_session=False)

    db.commit()
    return {"assigned": updated}
