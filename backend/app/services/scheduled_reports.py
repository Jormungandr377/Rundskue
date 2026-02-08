"""Scheduled report email service."""
import logging
from datetime import datetime, timezone, timedelta
from typing import List

from sqlalchemy.orm import Session
from sqlalchemy import and_

from ..database import SessionLocal
from ..models import ScheduledReport, User, Transaction, Budget, Account
from ..services.email import send_email

logger = logging.getLogger(__name__)


async def send_scheduled_reports():
    """
    Check for scheduled reports that need to be sent and send them.
    Called daily by APScheduler at 6 AM.
    """
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        reports_sent = 0
        reports_failed = 0

        # Get all active scheduled reports
        scheduled_reports = db.query(ScheduledReport).filter(
            ScheduledReport.is_active == True
        ).all()

        for report in scheduled_reports:
            try:
                should_send = _should_send_report(report, now)

                if should_send:
                    user = db.query(User).filter(User.id == report.user_id).first()
                    if not user or not user.email:
                        logger.warning(f"Cannot send report {report.id}: user not found or no email")
                        continue

                    # Generate and send report based on type
                    if report.report_type == "weekly_summary":
                        await _send_weekly_summary(db, user, report)
                    elif report.report_type == "monthly_summary":
                        await _send_monthly_summary(db, user, report)
                    elif report.report_type == "budget_status":
                        await _send_budget_status(db, user, report)
                    else:
                        logger.warning(f"Unknown report type: {report.report_type}")
                        continue

                    # Update last_sent timestamp
                    report.last_sent = now
                    db.commit()
                    reports_sent += 1
                    logger.info(f"Sent {report.report_type} report to {user.email}")

            except Exception as e:
                reports_failed += 1
                logger.error(f"Failed to send scheduled report {report.id}: {e}")
                db.rollback()

        logger.info(f"Scheduled reports: {reports_sent} sent, {reports_failed} failed")

    finally:
        db.close()


def _should_send_report(report: ScheduledReport, now: datetime) -> bool:
    """Determine if a report should be sent based on its schedule."""
    # If never sent, send it
    if not report.last_sent:
        return True

    # Check if enough time has passed since last send
    if report.frequency == "weekly":
        # Check if it's the right day of week and hasn't been sent this week
        if now.weekday() == report.day_of_week:
            days_since_last = (now - report.last_sent).days
            return days_since_last >= 7

    elif report.frequency == "monthly":
        # Check if it's the right day of month and hasn't been sent this month
        if now.day == report.day_of_month:
            # Ensure at least 28 days have passed to avoid double-sending
            days_since_last = (now - report.last_sent).days
            return days_since_last >= 28

    return False


async def _send_weekly_summary(db: Session, user: User, report: ScheduledReport):
    """Send weekly spending summary email."""
    # Get last 7 days of transactions
    end_date = datetime.now(timezone.utc).date()
    start_date = end_date - timedelta(days=7)

    # Get user's profile IDs
    profile_ids = [p.id for p in user.profiles]

    # Calculate weekly spending
    transactions = db.query(Transaction).join(Account).filter(
        and_(
            Account.profile_id.in_(profile_ids),
            Transaction.date >= start_date,
            Transaction.date <= end_date,
            Transaction.amount > 0,  # Expenses only
            Transaction.is_excluded == False,
            Transaction.is_transfer == False
        )
    ).all()

    total_spent = sum(t.amount for t in transactions)
    transaction_count = len(transactions)

    # Create email content
    subject = f"Your Weekly Spending Summary - {start_date} to {end_date}"
    body = f"""
    <h2>Weekly Spending Summary</h2>
    <p>Here's your spending overview for the past 7 days:</p>

    <ul>
        <li><strong>Total Spent:</strong> ${total_spent:,.2f}</li>
        <li><strong>Transactions:</strong> {transaction_count}</li>
        <li><strong>Average per day:</strong> ${total_spent/7:,.2f}</li>
    </ul>

    <p>Login to your Finance Tracker to see detailed breakdowns by category.</p>

    <p style="color: #666; font-size: 12px;">
        You're receiving this because you have scheduled weekly reports enabled.
        Manage your report preferences in Settings.
    </p>
    """

    await send_email(
        to_email=user.email,
        subject=subject,
        body=body
    )


async def _send_monthly_summary(db: Session, user: User, report: ScheduledReport):
    """Send monthly spending summary email."""
    # Get last 30 days of transactions
    end_date = datetime.now(timezone.utc).date()
    start_date = end_date - timedelta(days=30)

    profile_ids = [p.id for p in user.profiles]

    transactions = db.query(Transaction).join(Account).filter(
        and_(
            Account.profile_id.in_(profile_ids),
            Transaction.date >= start_date,
            Transaction.date <= end_date,
            Transaction.amount > 0,
            Transaction.is_excluded == False,
            Transaction.is_transfer == False
        )
    ).all()

    total_spent = sum(t.amount for t in transactions)
    total_income = sum(abs(t.amount) for t in transactions if t.amount < 0)

    subject = f"Your Monthly Summary - {start_date} to {end_date}"
    body = f"""
    <h2>Monthly Financial Summary</h2>
    <p>Here's your overview for the past 30 days:</p>

    <ul>
        <li><strong>Total Spent:</strong> ${total_spent:,.2f}</li>
        <li><strong>Total Income:</strong> ${total_income:,.2f}</li>
        <li><strong>Net:</strong> ${total_income - total_spent:,.2f}</li>
        <li><strong>Transactions:</strong> {len(transactions)}</li>
    </ul>

    <p>Login to your Finance Tracker for detailed insights and reports.</p>

    <p style="color: #666; font-size: 12px;">
        You're receiving this because you have scheduled monthly reports enabled.
        Manage your report preferences in Settings.
    </p>
    """

    await send_email(
        to_email=user.email,
        subject=subject,
        body=body
    )


async def _send_budget_status(db: Session, user: User, report: ScheduledReport):
    """Send budget status email."""
    profile_ids = [p.id for p in user.profiles]

    # Get current month's budgets
    now = datetime.now(timezone.utc)
    current_month = now.month
    current_year = now.year

    budgets = db.query(Budget).filter(
        and_(
            Budget.profile_id.in_(profile_ids),
            Budget.month == current_month,
            Budget.year == current_year
        )
    ).all()

    if not budgets:
        return  # No budgets to report on

    budget_lines = []
    for budget in budgets:
        # Calculate spent amount (simplified - should use proper calculation)
        spent = 0  # TODO: Calculate actual spent from transactions
        percentage = (spent / budget.amount * 100) if budget.amount > 0 else 0

        status = "✅" if percentage < 80 else "⚠️" if percentage < 100 else "🚨"
        budget_lines.append(
            f"<li>{status} <strong>{budget.name or 'Budget'}:</strong> "
            f"${spent:,.2f} / ${budget.amount:,.2f} ({percentage:.0f}%)</li>"
        )

    subject = "Your Budget Status Update"
    body = f"""
    <h2>Budget Status for {now.strftime('%B %Y')}</h2>
    <p>Here's how you're tracking against your budgets:</p>

    <ul>
        {''.join(budget_lines)}
    </ul>

    <p>Login to your Finance Tracker to adjust budgets or review spending details.</p>

    <p style="color: #666; font-size: 12px;">
        You're receiving this because you have scheduled budget status reports enabled.
        Manage your report preferences in Settings.
    </p>
    """

    await send_email(
        to_email=user.email,
        subject=subject,
        body=body
    )
