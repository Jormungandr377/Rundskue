from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_active_user
from ..models import User, ScheduledReport, Profile
from ..services.email import send_email
from ..services.report_generator import (
    generate_weekly_summary,
    generate_monthly_summary,
    render_report_html,
)

router = APIRouter(prefix="/reports", tags=["reports"])

# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

VALID_REPORT_TYPES = {"weekly_summary", "monthly_summary", "budget_status"}
VALID_FREQUENCIES = {"weekly", "monthly"}


class ReportCreate(BaseModel):
    report_type: str
    frequency: str
    day_of_week: Optional[int] = None
    day_of_month: Optional[int] = None


class ReportUpdate(BaseModel):
    is_active: Optional[bool] = None
    frequency: Optional[str] = None
    day_of_week: Optional[int] = None
    day_of_month: Optional[int] = None


class ReportResponse(BaseModel):
    id: int
    user_id: int
    report_type: str
    frequency: str
    day_of_week: Optional[int] = None
    day_of_month: Optional[int] = None
    is_active: bool
    last_sent: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Helper – ownership check
# ---------------------------------------------------------------------------

def _get_report_or_404(
    report_id: int,
    user: User,
    db: Session,
) -> ScheduledReport:
    # Single query with both ID and user_id to prevent resource enumeration
    report = (
        db.query(ScheduledReport)
        .filter(
            ScheduledReport.id == report_id,
            ScheduledReport.user_id == user.id,
        )
        .first()
    )
    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scheduled report not found",
        )
    return report


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

def _validate_create(data: ReportCreate) -> None:
    if data.report_type not in VALID_REPORT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"report_type must be one of {VALID_REPORT_TYPES}",
        )
    if data.frequency not in VALID_FREQUENCIES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"frequency must be one of {VALID_FREQUENCIES}",
        )
    if data.frequency == "weekly":
        if data.day_of_week is None or not (0 <= data.day_of_week <= 6):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="day_of_week is required for weekly frequency and must be 0-6",
            )
    if data.frequency == "monthly":
        if data.day_of_month is None or not (1 <= data.day_of_month <= 28):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="day_of_month is required for monthly frequency and must be 1-28",
            )


def _validate_update(data: ReportUpdate, existing: ScheduledReport) -> None:
    frequency = data.frequency if data.frequency is not None else existing.frequency

    if data.frequency is not None and data.frequency not in VALID_FREQUENCIES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"frequency must be one of {VALID_FREQUENCIES}",
        )

    day_of_week = data.day_of_week if data.day_of_week is not None else existing.day_of_week
    day_of_month = data.day_of_month if data.day_of_month is not None else existing.day_of_month

    if frequency == "weekly":
        if day_of_week is None or not (0 <= day_of_week <= 6):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="day_of_week must be 0-6 for weekly frequency",
            )
    if frequency == "monthly":
        if day_of_month is None or not (1 <= day_of_month <= 28):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="day_of_month must be 1-28 for monthly frequency",
            )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/scheduled", response_model=List[ReportResponse])
def list_scheduled_reports(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """List all scheduled reports for the current user."""
    reports = (
        db.query(ScheduledReport)
        .filter(ScheduledReport.user_id == current_user.id)
        .all()
    )
    return reports


@router.post("/scheduled", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
def create_scheduled_report(
    data: ReportCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Create a new scheduled report."""
    _validate_create(data)

    report = ScheduledReport(
        user_id=current_user.id,
        report_type=data.report_type,
        frequency=data.frequency,
        day_of_week=data.day_of_week,
        day_of_month=data.day_of_month,
        is_active=True,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@router.put("/scheduled/{report_id}", response_model=ReportResponse)
def update_scheduled_report(
    report_id: int,
    data: ReportUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Update an existing scheduled report (ownership verified)."""
    report = _get_report_or_404(report_id, current_user, db)
    _validate_update(data, report)

    if data.is_active is not None:
        report.is_active = data.is_active
    if data.frequency is not None:
        report.frequency = data.frequency
    if data.day_of_week is not None:
        report.day_of_week = data.day_of_week
    if data.day_of_month is not None:
        report.day_of_month = data.day_of_month

    db.commit()
    db.refresh(report)
    return report


@router.delete("/scheduled/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scheduled_report(
    report_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Delete a scheduled report (ownership verified)."""
    report = _get_report_or_404(report_id, current_user, db)
    db.delete(report)
    db.commit()
    return None


@router.post("/scheduled/{report_id}/send-now")
def send_report_now(
    report_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Generate and immediately send the report via email."""
    report = _get_report_or_404(report_id, current_user, db)

    profiles = (
        db.query(Profile)
        .filter(Profile.user_id == current_user.id)
        .all()
    )

    # Generate the report data based on type
    if report.report_type == "weekly_summary":
        report_data = generate_weekly_summary(profiles)
    elif report.report_type == "monthly_summary":
        report_data = generate_monthly_summary(profiles)
    elif report.report_type == "budget_status":
        # budget_status uses the monthly summary generator as its base
        report_data = generate_monthly_summary(profiles)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown report type: {report.report_type}",
        )

    html_content = render_report_html(report_data)

    send_email(
        to=current_user.email,
        subject=f"Your {report.report_type.replace('_', ' ').title()} Report",
        html_body=html_content,
    )

    report.last_sent = datetime.utcnow()
    db.commit()

    return {"success": True, "message": "Report sent successfully"}
