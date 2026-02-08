"""Service for detecting recurring subscription patterns from transactions."""
import logging
from datetime import date, timedelta
from collections import defaultdict

from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models import Transaction, Account, Subscription

logger = logging.getLogger(__name__)


def detect_subscriptions(db: Session, profile_id: int) -> list[dict]:
    """
    Scan transactions for recurring patterns that look like subscriptions.

    Detection logic:
    - Group transactions by merchant_name
    - For each merchant, check if charges occur roughly monthly (± 5 days)
    - Check if amounts are similar (± 15%)
    - Require at least 2 occurrences in the last 6 months
    - Skip merchants already tracked as subscriptions
    """
    six_months_ago = date.today() - timedelta(days=180)

    # Get existing subscription merchant names to avoid duplicates
    existing = db.query(Subscription.merchant_name).filter(
        Subscription.profile_id == profile_id,
    ).all()
    existing_merchants = {r.merchant_name.lower() for r in existing if r.merchant_name}

    # Get expense transactions grouped by merchant
    txns = db.query(Transaction).join(Account).filter(
        Account.profile_id == profile_id,
        Transaction.date >= six_months_ago,
        Transaction.amount > 0,
        Transaction.is_excluded == False,
        Transaction.is_transfer == False,
        Transaction.merchant_name.isnot(None),
        Transaction.merchant_name != "",
    ).order_by(Transaction.merchant_name, Transaction.date).all()

    # Group by merchant
    merchant_txns = defaultdict(list)
    for txn in txns:
        merchant_txns[txn.merchant_name].append(txn)

    detected = []

    for merchant, transactions in merchant_txns.items():
        if len(transactions) < 2:
            continue
        if merchant.lower() in existing_merchants:
            continue

        # Check amount consistency (± 15%)
        amounts = [float(t.amount) for t in transactions]
        avg_amount = sum(amounts) / len(amounts)
        if avg_amount < 1:
            continue
        amount_consistent = all(
            abs(a - avg_amount) / avg_amount < 0.15 for a in amounts
        )
        if not amount_consistent:
            continue

        # Check date regularity (roughly monthly: 25-35 day gaps)
        dates = sorted([t.date for t in transactions])
        gaps = [(dates[i + 1] - dates[i]).days for i in range(len(dates) - 1)]
        if not gaps:
            continue

        avg_gap = sum(gaps) / len(gaps)

        # Determine frequency
        if 5 <= avg_gap <= 9:
            frequency = "weekly"
        elif 12 <= avg_gap <= 16:
            frequency = "biweekly"
        elif 25 <= avg_gap <= 35:
            frequency = "monthly"
        elif 80 <= avg_gap <= 100:
            frequency = "quarterly"
        elif 350 <= avg_gap <= 380:
            frequency = "yearly"
        else:
            continue

        last_date = dates[-1]
        # Flag as unused if no charge in last 60 days
        days_since = (date.today() - last_date).days
        is_unused = days_since > 60

        # Auto-create the subscription
        sub = Subscription(
            profile_id=profile_id,
            name=merchant,
            merchant_name=merchant,
            amount=round(avg_amount, 2),
            frequency=frequency,
            last_charged=last_date,
            is_flagged_unused=is_unused,
        )
        db.add(sub)

        detected.append({
            "name": merchant,
            "amount": round(avg_amount, 2),
            "frequency": frequency,
            "occurrences": len(transactions),
            "last_charged": last_date.isoformat(),
            "is_flagged_unused": is_unused,
        })

    if detected:
        db.commit()

    return detected
