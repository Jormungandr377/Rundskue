"""Notifications router - budget alerts, bill reminders, goal updates."""
from datetime import datetime, date, timedelta
from typing import List, Optional
from calendar import monthrange

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from ..database import get_db
from ..models import (
    Notification, User, Budget, BudgetItem, Transaction, Account,
    RecurringTransaction, Profile, Category
)
from ..dependencies import get_current_active_user

router = APIRouter(tags=["Notifications"])


# ============================================================================
# Schemas
# ============================================================================

class NotificationResponse(BaseModel):
    id: int
    type: str
    title: str
    message: str
    data: Optional[dict] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/", response_model=List[NotificationResponse])
async def list_notifications(
    unread_only: bool = False,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List notifications for the current user."""
    query = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread_only:
        query = query.filter(Notification.is_read == False)
    notifications = query.order_by(Notification.created_at.desc()).limit(limit).all()
    return notifications


@router.get("/unread-count")
async def unread_count(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get unread notification count."""
    count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).count()
    return {"count": count}


@router.put("/{notification_id}/read")
async def mark_read(
    notification_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mark a notification as read."""
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    return {"message": "Marked as read"}


@router.put("/read-all")
async def mark_all_read(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Mark all notifications as read."""
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"message": "All marked as read"}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a notification."""
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    db.delete(notif)
    db.commit()
    return {"message": "Notification deleted"}


@router.post("/check-budgets")
async def check_budget_alerts(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Check budgets and create alerts for overspending (80%+ threshold)."""
    profile_ids = [p.id for p in current_user.profiles]
    today = date.today()
    current_month = date(today.year, today.month, 1)

    # Get current month budgets
    budgets = db.query(Budget).filter(
        Budget.profile_id.in_(profile_ids),
        Budget.month == current_month
    ).all()

    alerts_created = 0

    for budget in budgets:
        for item in budget.items:
            budgeted = float(item.amount) if item.amount else 0
            if budgeted <= 0:
                continue

            # Calculate spent for this category
            _, last_day = monthrange(today.year, today.month)
            month_end = date(today.year, today.month, last_day)

            spent_result = db.query(func.sum(Transaction.amount)).join(Account).filter(
                Account.profile_id.in_(profile_ids),
                Transaction.category_id == item.category_id,
                Transaction.date >= current_month,
                Transaction.date <= month_end,
                Transaction.is_excluded == False,
                Transaction.is_transfer == False,
                Transaction.amount > 0
            ).scalar()

            spent = float(spent_result) if spent_result else 0
            pct = (spent / budgeted) * 100

            if pct >= 80:
                # Check if we already sent this alert today
                existing = db.query(Notification).filter(
                    Notification.user_id == current_user.id,
                    Notification.type == "budget_alert",
                    Notification.created_at >= datetime.combine(today, datetime.min.time()),
                    Notification.data.contains({"budget_item_id": item.id})
                ).first()

                if not existing:
                    cat = db.query(Category).filter(Category.id == item.category_id).first()
                    cat_name = cat.name if cat else "Unknown"

                    if pct >= 100:
                        title = f"Budget Exceeded: {cat_name}"
                        message = f"You've spent ${spent:.0f} of your ${budgeted:.0f} budget for {cat_name} ({pct:.0f}%)"
                    else:
                        title = f"Budget Warning: {cat_name}"
                        message = f"You've used {pct:.0f}% of your {cat_name} budget (${spent:.0f}/${budgeted:.0f})"

                    notif = Notification(
                        user_id=current_user.id,
                        type="budget_alert",
                        title=title,
                        message=message,
                        data={"budget_item_id": item.id, "category": cat_name, "pct": pct},
                    )
                    db.add(notif)
                    alerts_created += 1

    db.commit()
    return {"alerts_created": alerts_created}


@router.post("/check-bills")
async def check_bill_reminders(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create reminders for bills due within 3 days."""
    profile_ids = [p.id for p in current_user.profiles]
    today = date.today()
    reminder_cutoff = today + timedelta(days=3)

    upcoming = db.query(RecurringTransaction).filter(
        RecurringTransaction.profile_id.in_(profile_ids),
        RecurringTransaction.is_active == True,
        RecurringTransaction.next_due_date >= today,
        RecurringTransaction.next_due_date <= reminder_cutoff,
    ).all()

    reminders_created = 0

    for bill in upcoming:
        # Check if reminder already exists
        existing = db.query(Notification).filter(
            Notification.user_id == current_user.id,
            Notification.type == "bill_reminder",
            Notification.data.contains({"recurring_id": bill.id}),
            Notification.created_at >= datetime.combine(today, datetime.min.time()),
        ).first()

        if not existing:
            days_until = (bill.next_due_date - today).days
            if days_until == 0:
                time_str = "today"
            elif days_until == 1:
                time_str = "tomorrow"
            else:
                time_str = f"in {days_until} days"

            notif = Notification(
                user_id=current_user.id,
                type="bill_reminder",
                title=f"Bill Due: {bill.name}",
                message=f"{bill.name} (${float(bill.amount):.2f}) is due {time_str}",
                data={"recurring_id": bill.id, "amount": float(bill.amount), "due_date": bill.next_due_date.isoformat()},
            )
            db.add(notif)
            reminders_created += 1

    db.commit()
    return {"reminders_created": reminders_created}
