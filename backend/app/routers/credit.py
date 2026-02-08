"""Credit score tracking router."""
from datetime import datetime, date
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, Field, field_validator

from ..database import get_db
from ..models import CreditScore, User
from ..dependencies import get_current_active_user

router = APIRouter()


# ============================================================================
# Schemas
# ============================================================================

class CreditScoreCreate(BaseModel):
    score: int = Field(..., ge=300, le=850)
    source: str = Field(default="manual", max_length=50)
    date: date
    notes: Optional[str] = None

    @field_validator("source")
    @classmethod
    def validate_source(cls, v: str) -> str:
        allowed = {"manual", "api"}
        if v not in allowed:
            raise ValueError(f"source must be one of: {', '.join(allowed)}")
        return v


class CreditScoreResponse(BaseModel):
    id: int
    score: int
    source: str
    date: date
    notes: Optional[str]
    rating: str
    created_at: datetime

    class Config:
        from_attributes = True


class CreditScoreHistory(BaseModel):
    latest_score: Optional[int] = None
    latest_rating: Optional[str] = None
    score_change: Optional[int] = None
    highest_score: Optional[int] = None
    lowest_score: Optional[int] = None
    total_entries: int = 0
    entries: List[CreditScoreResponse] = []


# ============================================================================
# Helpers
# ============================================================================

def get_score_rating(score: int) -> str:
    """Return the credit rating category for a given score."""
    if score >= 800:
        return "Excellent"
    elif score >= 740:
        return "Very Good"
    elif score >= 670:
        return "Good"
    elif score >= 580:
        return "Fair"
    else:
        return "Poor"


def score_to_response(entry: CreditScore) -> CreditScoreResponse:
    """Convert a CreditScore model instance to a response schema."""
    return CreditScoreResponse(
        id=entry.id,
        score=entry.score,
        source=entry.source or "manual",
        date=entry.date,
        notes=entry.notes,
        rating=get_score_rating(entry.score),
        created_at=entry.created_at,
    )


# ============================================================================
# Endpoints
# ============================================================================

@router.post("/", response_model=CreditScoreResponse, status_code=status.HTTP_201_CREATED)
async def create_credit_score(
    data: CreditScoreCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Log a new credit score entry."""
    entry = CreditScore(
        user_id=current_user.id,
        score=data.score,
        source=data.source,
        date=data.date,
        notes=data.notes,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return score_to_response(entry)


@router.get("/history", response_model=CreditScoreHistory)
async def get_credit_score_history(
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get credit score history with summary statistics."""
    entries = (
        db.query(CreditScore)
        .filter(CreditScore.user_id == current_user.id)
        .order_by(CreditScore.date.desc(), CreditScore.created_at.desc())
        .limit(limit)
        .all()
    )

    if not entries:
        return CreditScoreHistory()

    # Aggregate stats across all entries for this user (not limited)
    stats = db.query(
        func.max(CreditScore.score),
        func.min(CreditScore.score),
        func.count(CreditScore.id),
    ).filter(CreditScore.user_id == current_user.id).one()

    highest_score, lowest_score, total_entries = stats

    # Latest is the first entry (ordered by date desc)
    latest = entries[0]

    # Score change: difference between the two most recent entries
    score_change = None
    if len(entries) >= 2:
        score_change = latest.score - entries[1].score

    return CreditScoreHistory(
        latest_score=latest.score,
        latest_rating=get_score_rating(latest.score),
        score_change=score_change,
        highest_score=highest_score,
        lowest_score=lowest_score,
        total_entries=total_entries,
        entries=[score_to_response(e) for e in entries],
    )


@router.get("/latest", response_model=CreditScoreResponse)
async def get_latest_credit_score(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Get the most recent credit score entry."""
    entry = (
        db.query(CreditScore)
        .filter(CreditScore.user_id == current_user.id)
        .order_by(CreditScore.date.desc(), CreditScore.created_at.desc())
        .first()
    )
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No credit score entries found",
        )
    return score_to_response(entry)


@router.delete("/{score_id}")
async def delete_credit_score(
    score_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Delete a credit score entry."""
    entry = db.query(CreditScore).filter(
        CreditScore.id == score_id,
        CreditScore.user_id == current_user.id,
    ).first()
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credit score entry not found",
        )
    db.delete(entry)
    db.commit()
    return {"message": "Credit score entry deleted"}
