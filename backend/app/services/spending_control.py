"""
Spending Control Service

Unified logic for budgets, envelopes, and savings rules.
Provides spending tracking, allocation management, and automated savings.
"""

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Tuple
from sqlalchemy import func, and_, or_, desc
from sqlalchemy.orm import Session

from ..models import SpendingControl, Transaction, Account, Category, SavingsGoal, Profile


class SpendingControlService:
    """Service for unified spending control management."""

    def __init__(self, db: Session):
        self.db = db

    def get_spending_for_control(
        self,
        control: SpendingControl,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Decimal:
        """
        Calculate total spending for a spending control.

        Args:
            control: SpendingControl instance
            start_date: Optional start date filter
            end_date: Optional end date filter

        Returns:
            Total spending amount
        """
        # Determine date range based on control period
        if not start_date or not end_date:
            if control.methodology == "budget" and control.month:
                # Budget: use the specified month
                start_date = control.month
                # Last day of month
                if control.month.month == 12:
                    end_date = date(control.month.year + 1, 1, 1) - timedelta(days=1)
                else:
                    end_date = date(control.month.year, control.month.month + 1, 1) - timedelta(days=1)
            elif control.period == "monthly":
                # Current month
                today = date.today()
                start_date = date(today.year, today.month, 1)
                if today.month == 12:
                    end_date = date(today.year + 1, 1, 1) - timedelta(days=1)
                else:
                    end_date = date(today.year, today.month + 1, 1) - timedelta(days=1)
            elif control.period == "weekly":
                # Current week
                today = date.today()
                start_date = today - timedelta(days=today.weekday())
                end_date = start_date + timedelta(days=6)
            else:
                # All time
                start_date = date(2000, 1, 1)
                end_date = date.today()

        # Build query
        query = self.db.query(
            func.coalesce(func.sum(func.abs(Transaction.amount)), 0)
        ).join(Account, Transaction.account_id == Account.id).filter(
            and_(
                Account.profile_id == control.profile_id,
                Transaction.date >= start_date,
                Transaction.date <= end_date,
                Transaction.amount > 0,  # Expenses are positive
                Transaction.is_excluded == False
            )
        )

        # Filter by category if specified
        if control.category_id:
            query = query.filter(Transaction.category_id == control.category_id)

        total = query.scalar() or Decimal('0')
        return Decimal(str(total))

    def get_remaining_amount(self, control: SpendingControl) -> Decimal:
        """
        Calculate remaining amount for a spending control.

        Args:
            control: SpendingControl instance

        Returns:
            Remaining amount (budget - spent + rollover)
        """
        spent = self.get_spending_for_control(control)
        total_available = Decimal(str(control.amount)) + Decimal(str(control.rollover_amount or 0))
        remaining = total_available - spent
        return remaining

    def get_utilization_percentage(self, control: SpendingControl) -> float:
        """
        Calculate utilization percentage for a spending control.

        Args:
            control: SpendingControl instance

        Returns:
            Utilization percentage (0-100+)
        """
        spent = self.get_spending_for_control(control)
        total_available = Decimal(str(control.amount)) + Decimal(str(control.rollover_amount or 0))

        if total_available == 0:
            return 0.0

        utilization = (spent / total_available) * 100
        return float(utilization)

    def check_alert_threshold(self, control: SpendingControl) -> bool:
        """
        Check if spending has exceeded alert threshold.

        Args:
            control: SpendingControl instance

        Returns:
            True if alert should be triggered
        """
        if control.methodology != "budget":
            return False

        utilization = self.get_utilization_percentage(control)
        return utilization >= control.alert_threshold_pct

    def apply_savings_rule(
        self,
        control: SpendingControl,
        transaction: Transaction
    ) -> Optional[Decimal]:
        """
        Apply a savings rule to a transaction and calculate amount to save.

        Args:
            control: SpendingControl with methodology='savings_rule'
            transaction: Transaction to apply rule to

        Returns:
            Amount to save, or None if rule doesn't apply
        """
        if control.methodology != "savings_rule":
            return None

        if not control.is_active:
            return None

        # Only apply to expense transactions
        if transaction.amount <= 0:
            return None

        if control.rule_type == "round_up":
            # Round up to nearest dollar
            round_to = control.round_up_to or 1
            transaction_amount = abs(float(transaction.amount))
            rounded = ((transaction_amount // round_to) + 1) * round_to
            save_amount = rounded - transaction_amount
            return Decimal(str(save_amount))

        elif control.rule_type == "percentage":
            # Save percentage of transaction
            if control.percentage:
                transaction_amount = abs(float(transaction.amount))
                save_amount = transaction_amount * (float(control.percentage) / 100)
                return Decimal(str(save_amount))

        elif control.rule_type == "fixed_schedule":
            # Fixed amount saved on schedule (handled separately, not per transaction)
            return None

        return None

    def process_scheduled_savings(
        self,
        profile_id: int,
        current_date: date
    ) -> List[Tuple[SpendingControl, Decimal]]:
        """
        Process all fixed schedule savings rules for a profile.

        Args:
            profile_id: Profile ID
            current_date: Current date to check schedules

        Returns:
            List of (control, amount) tuples to save
        """
        controls = self.db.query(SpendingControl).filter(
            and_(
                SpendingControl.profile_id == profile_id,
                SpendingControl.methodology == "savings_rule",
                SpendingControl.rule_type == "fixed_schedule",
                SpendingControl.is_active == True
            )
        ).all()

        results = []
        for control in controls:
            # Check if it's time to save based on frequency
            should_save = False

            if control.frequency == "weekly":
                # Save every Monday
                if current_date.weekday() == 0:
                    should_save = True
            elif control.frequency == "monthly":
                # Save on first day of month
                if current_date.day == 1:
                    should_save = True

            if should_save and control.amount:
                results.append((control, Decimal(str(control.amount))))

        return results

    def get_control_summary(
        self,
        profile_id: int,
        methodology: Optional[str] = None
    ) -> Dict:
        """
        Get summary statistics for spending controls.

        Args:
            profile_id: Profile ID
            methodology: Optional filter by methodology

        Returns:
            Dictionary with summary stats
        """
        query = self.db.query(SpendingControl).filter(
            SpendingControl.profile_id == profile_id
        )

        if methodology:
            query = query.filter(SpendingControl.methodology == methodology)

        controls = query.all()

        total_allocated = sum(float(c.amount) for c in controls if c.is_active)
        total_spent = sum(float(self.get_spending_for_control(c)) for c in controls if c.is_active)
        total_remaining = total_allocated - total_spent

        # Count by status
        active_count = sum(1 for c in controls if c.is_active)
        over_budget = sum(1 for c in controls if c.is_active and self.get_utilization_percentage(c) > 100)

        return {
            "total_allocated": round(total_allocated, 2),
            "total_spent": round(total_spent, 2),
            "total_remaining": round(total_remaining, 2),
            "active_count": active_count,
            "over_budget_count": over_budget,
            "controls": controls,
        }

    def migrate_from_legacy(
        self,
        profile_id: int,
        source_type: str
    ) -> int:
        """
        Migrate legacy budgets, envelopes, or savings rules to unified system.

        Args:
            profile_id: Profile ID
            source_type: "budget", "envelope", or "savings_rule"

        Returns:
            Number of items migrated
        """
        count = 0

        if source_type == "budget":
            from ..models import Budget, BudgetItem
            budgets = self.db.query(Budget).filter(
                Budget.profile_id == profile_id
            ).all()

            for budget in budgets:
                for item in budget.items:
                    control = SpendingControl(
                        profile_id=profile_id,
                        name=f"{budget.name} - {item.category.name if item.category else 'Uncategorized'}",
                        methodology="budget",
                        category_id=item.category_id,
                        amount=item.amount,
                        period="monthly",
                        is_active=True,
                        month=budget.month,
                        is_template=budget.is_template,
                        rollover_amount=item.rollover_amount or 0,
                    )
                    self.db.add(control)
                    count += 1

        elif source_type == "envelope":
            from ..models import Envelope
            envelopes = self.db.query(Envelope).filter(
                Envelope.profile_id == profile_id
            ).all()

            for envelope in envelopes:
                control = SpendingControl(
                    profile_id=profile_id,
                    name=envelope.name,
                    methodology="envelope",
                    amount=envelope.allocated_amount,
                    period="monthly",
                    is_active=envelope.is_active,
                    color=envelope.color,
                    icon=envelope.icon,
                )
                self.db.add(control)
                count += 1

        elif source_type == "savings_rule":
            from ..models import SavingsRule
            rules = self.db.query(SavingsRule).filter(
                SavingsRule.profile_id == profile_id
            ).all()

            for rule in rules:
                control = SpendingControl(
                    profile_id=profile_id,
                    name=f"Savings: {rule.goal.name if rule.goal else 'General'}",
                    methodology="savings_rule",
                    goal_id=rule.goal_id,
                    amount=rule.fixed_amount or 0,
                    period="monthly",
                    is_active=rule.is_active,
                    rule_type=rule.rule_type,
                    round_up_to=rule.round_up_to,
                    percentage=rule.percentage,
                    frequency=rule.frequency,
                    total_saved=rule.total_saved,
                )
                self.db.add(control)
                count += 1

        if count > 0:
            self.db.commit()

        return count
