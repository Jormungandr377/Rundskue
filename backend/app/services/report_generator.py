"""Report generator service for scheduled email reports."""
import logging
from datetime import datetime, timedelta, date
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models import (
    Transaction, Account, Profile, Budget, BudgetItem,
    Category, RecurringTransaction, SavingsGoal
)
from ..config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


def _format_currency(amount) -> str:
    """Format a number as currency."""
    try:
        val = float(amount or 0)
        return f"${val:,.2f}"
    except (TypeError, ValueError):
        return "$0.00"


def generate_weekly_summary(db: Session, user_id: int, profile_ids: list) -> dict:
    """Generate a weekly summary report data."""
    today = date.today()
    week_ago = today - timedelta(days=7)

    # Get transactions for the week
    txns = db.query(Transaction).join(Account).filter(
        Account.profile_id.in_(profile_ids),
        Transaction.date >= week_ago,
        Transaction.date <= today,
        Transaction.is_excluded == False,
    ).all()

    total_income = sum(float(t.amount) for t in txns if float(t.amount) < 0)  # Plaid: negative = income
    total_expenses = sum(float(t.amount) for t in txns if float(t.amount) > 0)

    # Top spending categories
    category_spending = {}
    for t in txns:
        if float(t.amount) > 0:  # expenses only
            cat_name = "Uncategorized"
            if t.category_id:
                cat = db.query(Category).filter(Category.id == t.category_id).first()
                if cat:
                    cat_name = cat.name
            category_spending[cat_name] = category_spending.get(cat_name, 0) + float(t.amount)

    top_categories = sorted(category_spending.items(), key=lambda x: x[1], reverse=True)[:5]

    # Upcoming bills (next 7 days)
    next_week = today + timedelta(days=7)
    upcoming = db.query(RecurringTransaction).filter(
        RecurringTransaction.profile_id.in_(profile_ids),
        RecurringTransaction.is_active == True,
        RecurringTransaction.next_due_date >= today,
        RecurringTransaction.next_due_date <= next_week,
    ).all()

    return {
        "period": f"{week_ago.strftime('%b %d')} - {today.strftime('%b %d, %Y')}",
        "total_income": abs(total_income),
        "total_expenses": total_expenses,
        "net": abs(total_income) - total_expenses,
        "transaction_count": len(txns),
        "top_categories": top_categories,
        "upcoming_bills": [(b.name, float(b.amount)) for b in upcoming],
    }


def generate_monthly_summary(db: Session, user_id: int, profile_ids: list) -> dict:
    """Generate a monthly summary report data."""
    today = date.today()
    month_start = today.replace(day=1)
    if today.month == 1:
        prev_month_start = date(today.year - 1, 12, 1)
    else:
        prev_month_start = date(today.year, today.month - 1, 1)

    # Current month transactions
    txns = db.query(Transaction).join(Account).filter(
        Account.profile_id.in_(profile_ids),
        Transaction.date >= month_start,
        Transaction.date <= today,
        Transaction.is_excluded == False,
    ).all()

    total_income = abs(sum(float(t.amount) for t in txns if float(t.amount) < 0))
    total_expenses = sum(float(t.amount) for t in txns if float(t.amount) > 0)

    # Budget status
    budgets = db.query(Budget).filter(
        Budget.profile_id.in_(profile_ids),
        Budget.month == month_start,
    ).all()

    budget_items_status = []
    for budget in budgets:
        for item in budget.items:
            cat = db.query(Category).filter(Category.id == item.category_id).first()
            budgeted = float(item.amount or 0)
            # Calculate spent
            spent_q = db.query(func.sum(Transaction.amount)).join(Account).filter(
                Account.profile_id.in_(profile_ids),
                Transaction.category_id == item.category_id,
                Transaction.date >= month_start,
                Transaction.date <= today,
                Transaction.amount > 0,
                Transaction.is_excluded == False,
            ).scalar() or 0
            spent = float(spent_q)
            if budgeted > 0:
                budget_items_status.append({
                    "category": cat.name if cat else "Unknown",
                    "budgeted": budgeted,
                    "spent": spent,
                    "pct": round(spent / budgeted * 100) if budgeted > 0 else 0,
                })

    # Goals progress
    goals = db.query(SavingsGoal).filter(
        SavingsGoal.profile_id.in_(profile_ids),
        SavingsGoal.is_completed == False,
    ).all()

    goals_data = []
    for g in goals:
        pct = round(float(g.current_amount or 0) / float(g.target_amount) * 100) if float(g.target_amount) > 0 else 0
        goals_data.append({
            "name": g.name,
            "current": float(g.current_amount or 0),
            "target": float(g.target_amount),
            "pct": min(pct, 100),
        })

    return {
        "month": today.strftime("%B %Y"),
        "total_income": total_income,
        "total_expenses": total_expenses,
        "net": total_income - total_expenses,
        "savings_rate": round((total_income - total_expenses) / total_income * 100) if total_income > 0 else 0,
        "transaction_count": len(txns),
        "budget_status": budget_items_status[:10],
        "goals": goals_data,
    }


def render_report_html(report_type: str, data: dict) -> str:
    """Render report data as HTML email."""
    if report_type == "weekly_summary":
        return _render_weekly_html(data)
    elif report_type == "monthly_summary":
        return _render_monthly_html(data)
    elif report_type == "budget_status":
        return _render_budget_html(data)
    return "<p>Unknown report type</p>"


def _render_weekly_html(data: dict) -> str:
    categories_html = ""
    for name, amount in data.get("top_categories", []):
        categories_html += f'<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;">{name}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">{_format_currency(amount)}</td></tr>'

    bills_html = ""
    for name, amount in data.get("upcoming_bills", []):
        bills_html += f'<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;">{name}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">{_format_currency(amount)}</td></tr>'

    return f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
        <div style="background:#f8f9fa;border-radius:8px;padding:30px;margin:20px 0;">
            <h1 style="color:#0d9488;margin-top:0;">Weekly Financial Summary</h1>
            <p style="color:#6b7280;">{data.get('period', '')}</p>

            <div style="display:flex;gap:16px;margin:20px 0;">
                <div style="flex:1;background:#fff;border-radius:8px;padding:16px;text-align:center;">
                    <p style="color:#6b7280;font-size:12px;margin:0;">Income</p>
                    <p style="font-size:24px;font-weight:bold;color:#10b981;margin:4px 0;">{_format_currency(data.get('total_income', 0))}</p>
                </div>
                <div style="flex:1;background:#fff;border-radius:8px;padding:16px;text-align:center;">
                    <p style="color:#6b7280;font-size:12px;margin:0;">Expenses</p>
                    <p style="font-size:24px;font-weight:bold;color:#ef4444;margin:4px 0;">{_format_currency(data.get('total_expenses', 0))}</p>
                </div>
                <div style="flex:1;background:#fff;border-radius:8px;padding:16px;text-align:center;">
                    <p style="color:#6b7280;font-size:12px;margin:0;">Net</p>
                    <p style="font-size:24px;font-weight:bold;color:#0d9488;margin:4px 0;">{_format_currency(data.get('net', 0))}</p>
                </div>
            </div>

            <h2 style="color:#1e40af;font-size:16px;">Top Spending Categories</h2>
            <table style="width:100%;border-collapse:collapse;">
                {categories_html if categories_html else '<tr><td style="padding:8px;color:#6b7280;">No spending this week</td></tr>'}
            </table>

            {"<h2 style='color:#1e40af;font-size:16px;'>Upcoming Bills</h2><table style='width:100%;border-collapse:collapse;'>" + bills_html + "</table>" if bills_html else ""}
        </div>
        <div style="text-align:center;color:#6b7280;font-size:12px;margin-top:20px;">
            <p>Finance Tracker - {data.get('period', '')}</p>
        </div>
    </body>
    </html>
    """


def _render_monthly_html(data: dict) -> str:
    budget_html = ""
    for item in data.get("budget_status", []):
        color = "#10b981" if item["pct"] < 80 else ("#f59e0b" if item["pct"] < 100 else "#ef4444")
        budget_html += f'''
        <tr>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;">{item["category"]}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">{_format_currency(item["spent"])} / {_format_currency(item["budgeted"])}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;color:{color};font-weight:bold;">{item["pct"]}%</td>
        </tr>'''

    goals_html = ""
    for g in data.get("goals", []):
        goals_html += f'''
        <tr>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;">{g["name"]}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">{_format_currency(g["current"])} / {_format_currency(g["target"])}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:bold;">{g["pct"]}%</td>
        </tr>'''

    return f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
        <div style="background:#f8f9fa;border-radius:8px;padding:30px;margin:20px 0;">
            <h1 style="color:#0d9488;margin-top:0;">Monthly Financial Summary</h1>
            <p style="color:#6b7280;">{data.get('month', '')}</p>

            <div style="display:flex;gap:16px;margin:20px 0;">
                <div style="flex:1;background:#fff;border-radius:8px;padding:16px;text-align:center;">
                    <p style="color:#6b7280;font-size:12px;margin:0;">Income</p>
                    <p style="font-size:24px;font-weight:bold;color:#10b981;margin:4px 0;">{_format_currency(data.get('total_income', 0))}</p>
                </div>
                <div style="flex:1;background:#fff;border-radius:8px;padding:16px;text-align:center;">
                    <p style="color:#6b7280;font-size:12px;margin:0;">Expenses</p>
                    <p style="font-size:24px;font-weight:bold;color:#ef4444;margin:4px 0;">{_format_currency(data.get('total_expenses', 0))}</p>
                </div>
                <div style="flex:1;background:#fff;border-radius:8px;padding:16px;text-align:center;">
                    <p style="color:#6b7280;font-size:12px;margin:0;">Savings Rate</p>
                    <p style="font-size:24px;font-weight:bold;color:#0d9488;margin:4px 0;">{data.get('savings_rate', 0)}%</p>
                </div>
            </div>

            {"<h2 style='color:#1e40af;font-size:16px;'>Budget Status</h2><table style='width:100%;border-collapse:collapse;'>" + budget_html + "</table>" if budget_html else ""}
            {"<h2 style='color:#1e40af;font-size:16px;margin-top:20px;'>Savings Goals</h2><table style='width:100%;border-collapse:collapse;'>" + goals_html + "</table>" if goals_html else ""}
        </div>
        <div style="text-align:center;color:#6b7280;font-size:12px;margin-top:20px;">
            <p>Finance Tracker - {data.get('month', '')}</p>
        </div>
    </body>
    </html>
    """


def _render_budget_html(data: dict) -> str:
    """Render budget status report - reuses monthly data."""
    return _render_monthly_html(data)
