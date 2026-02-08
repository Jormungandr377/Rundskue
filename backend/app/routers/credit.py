"""Credit score tracking router."""
from datetime import datetime, date
from typing import Optional, List, Dict

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, Field, field_validator

from ..database import get_db
from ..models import CreditScore, User, Profile
from ..dependencies import get_current_active_user
from ..services import audit
from ..services.credit_health import CreditHealthService

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


class CreditHealthMetrics(BaseModel):
    """Comprehensive credit health metrics."""
    credit_score: Optional[int] = None
    credit_score_date: Optional[str] = None
    credit_utilization: float
    total_credit_limit: float
    total_credit_used: float
    debt_to_income_ratio: float
    monthly_debt_payment: float
    monthly_income: float
    total_debt: float
    debt_count: int
    health_score: int
    health_rating: str


class PayoffScenario(BaseModel):
    """Debt payoff scenario for credit score projection."""
    payoff_plan: Dict[int, float] = Field(
        ...,
        description="Map of debt_id to additional monthly payment amount"
    )


class CreditProjection(BaseModel):
    """Credit score projection based on debt payoff."""
    current_score: int
    current_utilization: float
    current_dti: float
    projections: List[Dict]
    total_months: int
    total_debts: int


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
    request: Request,
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
    audit.log_from_request(db, request, audit.RESOURCE_DELETED, user_id=current_user.id, resource_type="credit_score", resource_id=str(score_id))
    return {"message": "Credit score entry deleted"}


@router.get("/health", response_model=CreditHealthMetrics)
async def get_credit_health(
    monthly_income: Optional[float] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get comprehensive credit health metrics.

    Includes:
    - Credit score and history
    - Credit utilization percentage
    - Debt-to-income ratio
    - Overall health score (0-100)

    Query params:
    - monthly_income: Override estimated monthly income (optional)
    """
    # Get user's profiles
    profiles = db.query(Profile).filter(Profile.user_id == current_user.id).all()
    profile_ids = [p.id for p in profiles]

    if not profile_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No profiles found for user"
        )

    # Calculate metrics
    service = CreditHealthService(db)
    metrics = service.get_credit_health_snapshot(
        user_id=current_user.id,
        profile_ids=profile_ids,
        monthly_income=monthly_income
    )

    return CreditHealthMetrics(**metrics)


@router.post("/project", response_model=CreditProjection)
async def project_credit_score(
    scenario: PayoffScenario,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Project credit score improvement based on debt payoff scenario.

    Provide a map of debt_id to additional monthly payment to see
    projected credit score improvements over time.

    Example request body:
    ```json
    {
        "payoff_plan": {
            "1": 500.00,
            "2": 200.00
        }
    }
    ```
    """
    # Get user's profiles
    profiles = db.query(Profile).filter(Profile.user_id == current_user.id).all()
    profile_ids = [p.id for p in profiles]

    if not profile_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No profiles found for user"
        )

    # Generate projection
    service = CreditHealthService(db)
    projection = service.project_credit_score(
        user_id=current_user.id,
        profile_ids=profile_ids,
        payoff_scenario=scenario.payoff_plan
    )

    return CreditProjection(**projection)


@router.post("/{score_id}/calculate-metrics", response_model=CreditScoreResponse)
async def calculate_credit_metrics(
    score_id: int,
    monthly_income: Optional[float] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Calculate and attach credit health metrics to a specific credit score entry.

    This will populate utilization, DTI, and other metrics for historical tracking.

    Query params:
    - monthly_income: Override estimated monthly income (optional)
    """
    # Verify credit score belongs to user
    entry = db.query(CreditScore).filter(
        CreditScore.id == score_id,
        CreditScore.user_id == current_user.id,
    ).first()

    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credit score entry not found"
        )

    # Get user's profiles
    profiles = db.query(Profile).filter(Profile.user_id == current_user.id).all()
    profile_ids = [p.id for p in profiles]

    if not profile_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No profiles found for user"
        )

    # Calculate and update metrics
    service = CreditHealthService(db)
    updated_entry = service.update_credit_score_metrics(
        credit_score_id=score_id,
        user_id=current_user.id,
        profile_ids=profile_ids,
        monthly_income=monthly_income
    )

    return score_to_response(updated_entry)
