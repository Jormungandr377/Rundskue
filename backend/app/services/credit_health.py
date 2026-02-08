"""
Credit Health Service

Calculates credit health metrics, debt-to-income ratio, credit utilization,
and provides credit score projections based on debt payoff scenarios.
"""

from datetime import date, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Tuple
from sqlalchemy import func, and_, desc
from sqlalchemy.orm import Session

from ..models import CreditScore, Debt, Account, Transaction, Profile


class CreditHealthService:
    """Service for calculating credit health metrics and projections."""

    def __init__(self, db: Session):
        self.db = db

    def calculate_credit_utilization(
        self,
        profile_ids: List[int],
        user_id: int
    ) -> Tuple[float, float, float]:
        """
        Calculate credit utilization from credit card accounts.

        Returns:
            (utilization_percentage, total_limit, total_used)
        """
        # Get all credit card accounts for profiles
        credit_accounts = self.db.query(Account).filter(
            and_(
                Account.profile_id.in_(profile_ids),
                Account.type == "credit"
            )
        ).all()

        if not credit_accounts:
            return (0.0, 0.0, 0.0)

        total_limit = sum(
            float(acc.available_balance or 0) + abs(float(acc.current_balance or 0))
            for acc in credit_accounts
        )
        total_used = sum(
            abs(float(acc.current_balance or 0))
            for acc in credit_accounts
        )

        utilization = (total_used / total_limit * 100) if total_limit > 0 else 0.0

        return (utilization, total_limit, total_used)

    def calculate_debt_to_income(
        self,
        profile_ids: List[int],
        monthly_income: Optional[float] = None
    ) -> Tuple[float, float, float]:
        """
        Calculate debt-to-income ratio.

        Args:
            profile_ids: List of profile IDs to include
            monthly_income: Optional monthly income override. If None, will estimate from transactions.

        Returns:
            (dti_percentage, monthly_debt_payment, monthly_income)
        """
        # Calculate total monthly debt payments
        debts = self.db.query(Debt).filter(
            Debt.profile_id.in_(profile_ids)
        ).all()

        monthly_debt_payment = sum(float(d.minimum_payment or 0) for d in debts)

        # Estimate monthly income if not provided
        if monthly_income is None:
            monthly_income = self._estimate_monthly_income(profile_ids)

        # Calculate DTI ratio
        dti = (monthly_debt_payment / monthly_income * 100) if monthly_income > 0 else 0.0

        return (dti, monthly_debt_payment, monthly_income)

    def _estimate_monthly_income(self, profile_ids: List[int]) -> float:
        """
        Estimate monthly income from last 90 days of income transactions.

        Args:
            profile_ids: List of profile IDs

        Returns:
            Estimated monthly income
        """
        ninety_days_ago = date.today() - timedelta(days=90)

        # Get income transactions (negative amounts in Plaid)
        total_income = self.db.query(
            func.coalesce(func.sum(func.abs(Transaction.amount)), 0)
        ).join(Account, Transaction.account_id == Account.id).filter(
            and_(
                Account.profile_id.in_(profile_ids),
                Transaction.amount < 0,  # Income is negative
                Transaction.date >= ninety_days_ago,
                Transaction.is_excluded == False,
                Transaction.is_transfer == False
            )
        ).scalar() or 0.0

        # Convert 90-day total to monthly average
        monthly_income = float(total_income) / 3

        return monthly_income if monthly_income > 0 else 0.0

    def get_credit_health_snapshot(
        self,
        user_id: int,
        profile_ids: List[int],
        monthly_income: Optional[float] = None
    ) -> Dict:
        """
        Get comprehensive credit health snapshot.

        Args:
            user_id: User ID
            profile_ids: List of profile IDs
            monthly_income: Optional monthly income override

        Returns:
            Dictionary with credit health metrics
        """
        # Get latest credit score
        latest_score = self.db.query(CreditScore).filter(
            CreditScore.user_id == user_id
        ).order_by(desc(CreditScore.date)).first()

        # Calculate metrics
        utilization, total_limit, total_used = self.calculate_credit_utilization(
            profile_ids, user_id
        )
        dti, monthly_debt_payment, estimated_income = self.calculate_debt_to_income(
            profile_ids, monthly_income
        )

        # Get debt summary
        debts = self.db.query(Debt).filter(
            Debt.profile_id.in_(profile_ids)
        ).all()

        total_debt = sum(float(d.balance or 0) for d in debts)
        debt_count = len(debts)

        # Calculate health score (0-100)
        health_score = self._calculate_health_score(
            credit_score=latest_score.score if latest_score else None,
            utilization=utilization,
            dti=dti,
            debt_count=debt_count
        )

        return {
            "credit_score": latest_score.score if latest_score else None,
            "credit_score_date": latest_score.date.isoformat() if latest_score else None,
            "credit_utilization": round(utilization, 2),
            "total_credit_limit": round(total_limit, 2),
            "total_credit_used": round(total_used, 2),
            "debt_to_income_ratio": round(dti, 2),
            "monthly_debt_payment": round(monthly_debt_payment, 2),
            "monthly_income": round(estimated_income, 2),
            "total_debt": round(total_debt, 2),
            "debt_count": debt_count,
            "health_score": health_score,
            "health_rating": self._get_health_rating(health_score)
        }

    def _calculate_health_score(
        self,
        credit_score: Optional[int],
        utilization: float,
        dti: float,
        debt_count: int
    ) -> int:
        """
        Calculate overall credit health score (0-100).

        Factors:
        - Credit score: 40% weight
        - Utilization: 30% weight (< 30% is good)
        - DTI: 20% weight (< 36% is good)
        - Debt count: 10% weight (fewer is better)
        """
        score = 0

        # Credit score component (40 points)
        if credit_score:
            if credit_score >= 800:
                score += 40
            elif credit_score >= 740:
                score += 35
            elif credit_score >= 670:
                score += 25
            elif credit_score >= 580:
                score += 15
            else:
                score += 5

        # Utilization component (30 points)
        if utilization <= 10:
            score += 30
        elif utilization <= 30:
            score += 25
        elif utilization <= 50:
            score += 15
        elif utilization <= 75:
            score += 5
        # else: 0 points

        # DTI component (20 points)
        if dti <= 20:
            score += 20
        elif dti <= 36:
            score += 15
        elif dti <= 43:
            score += 10
        elif dti <= 50:
            score += 5
        # else: 0 points

        # Debt count component (10 points)
        if debt_count == 0:
            score += 10
        elif debt_count <= 2:
            score += 8
        elif debt_count <= 4:
            score += 5
        elif debt_count <= 6:
            score += 3
        # else: 0 points

        return min(score, 100)

    def _get_health_rating(self, health_score: int) -> str:
        """Convert health score to rating."""
        if health_score >= 80:
            return "Excellent"
        elif health_score >= 60:
            return "Good"
        elif health_score >= 40:
            return "Fair"
        elif health_score >= 20:
            return "Poor"
        else:
            return "Critical"

    def project_credit_score(
        self,
        user_id: int,
        profile_ids: List[int],
        payoff_scenario: Dict[int, float]  # debt_id -> additional_payment_per_month
    ) -> Dict:
        """
        Project credit score improvement based on debt payoff scenario.

        Args:
            user_id: User ID
            profile_ids: List of profile IDs
            payoff_scenario: Dict mapping debt_id to additional monthly payment

        Returns:
            Projection with timeline and score estimates
        """
        # Get current score
        latest_score = self.db.query(CreditScore).filter(
            CreditScore.user_id == user_id
        ).order_by(desc(CreditScore.date)).first()

        current_score = latest_score.score if latest_score else 650

        # Get current metrics
        current_utilization, _, _ = self.calculate_credit_utilization(profile_ids, user_id)
        current_dti, _, monthly_income = self.calculate_debt_to_income(profile_ids)

        # Get debts
        debts = self.db.query(Debt).filter(
            Debt.profile_id.in_(profile_ids)
        ).all()

        # Simulate payoff timeline
        months_to_payoff = {}
        projected_scores = []

        for debt in debts:
            debt_id = debt.id
            balance = float(debt.balance)
            interest_rate = float(debt.interest_rate) / 100 / 12  # Monthly rate
            minimum_payment = float(debt.minimum_payment)
            extra_payment = payoff_scenario.get(debt_id, 0.0)
            total_payment = minimum_payment + extra_payment

            # Calculate payoff time
            if total_payment <= balance * interest_rate:
                months_to_payoff[debt_id] = 999  # Never pays off
            else:
                months = self._calculate_payoff_months(
                    balance, interest_rate, total_payment
                )
                months_to_payoff[debt_id] = months

        # Create timeline projections (every 6 months)
        max_months = max(months_to_payoff.values()) if months_to_payoff else 0
        projection_points = [0, 6, 12, 18, 24, 36, 48, 60]
        projection_points = [m for m in projection_points if m <= max_months]

        for month in projection_points:
            # Calculate what debts are paid off by this month
            remaining_debt = sum(
                float(d.balance)
                for d in debts
                if months_to_payoff.get(d.id, 999) > month
            )

            # Estimate score improvement
            debt_reduction_pct = (
                (sum(float(d.balance) for d in debts) - remaining_debt) /
                sum(float(d.balance) for d in debts) * 100
            ) if debts else 0

            # Score improvement factors:
            # - Utilization improvement: +1 point per 10% reduction
            # - DTI improvement: +1 point per 5% reduction
            # - Debt count reduction: +10 points per debt paid off
            utilization_improvement = debt_reduction_pct / 10
            dti_improvement = debt_reduction_pct / 5
            debts_paid_off = sum(
                1 for d in debts if months_to_payoff.get(d.id, 999) <= month
            )

            estimated_score = int(
                current_score +
                utilization_improvement +
                dti_improvement +
                (debts_paid_off * 10)
            )
            estimated_score = min(estimated_score, 850)  # Cap at 850

            projected_scores.append({
                "month": month,
                "estimated_score": estimated_score,
                "remaining_debt": round(remaining_debt, 2),
                "debts_paid_off": debts_paid_off
            })

        return {
            "current_score": current_score,
            "current_utilization": round(current_utilization, 2),
            "current_dti": round(current_dti, 2),
            "projections": projected_scores,
            "total_months": max_months,
            "total_debts": len(debts)
        }

    def _calculate_payoff_months(
        self,
        balance: float,
        monthly_rate: float,
        payment: float
    ) -> int:
        """
        Calculate number of months to pay off a debt.

        Args:
            balance: Current balance
            monthly_rate: Monthly interest rate (decimal, e.g., 0.015 for 1.5%)
            payment: Monthly payment amount

        Returns:
            Number of months to payoff
        """
        if payment <= 0 or balance <= 0:
            return 0

        if monthly_rate == 0:
            return int(balance / payment) + 1

        # Amortization formula
        import math
        months = math.log(payment / (payment - balance * monthly_rate)) / math.log(1 + monthly_rate)
        return int(months) + 1

    def update_credit_score_metrics(
        self,
        credit_score_id: int,
        user_id: int,
        profile_ids: List[int],
        monthly_income: Optional[float] = None
    ) -> CreditScore:
        """
        Update a credit score entry with calculated health metrics.

        Args:
            credit_score_id: Credit score ID to update
            user_id: User ID
            profile_ids: List of profile IDs
            monthly_income: Optional monthly income override

        Returns:
            Updated CreditScore object
        """
        credit_score = self.db.query(CreditScore).filter(
            and_(
                CreditScore.id == credit_score_id,
                CreditScore.user_id == user_id
            )
        ).first()

        if not credit_score:
            raise ValueError("Credit score not found")

        # Calculate metrics
        utilization, total_limit, total_used = self.calculate_credit_utilization(
            profile_ids, user_id
        )
        dti, monthly_debt_payment, estimated_income = self.calculate_debt_to_income(
            profile_ids, monthly_income
        )

        # Update fields
        credit_score.credit_utilization = Decimal(str(round(utilization, 2)))
        credit_score.debt_to_income_ratio = Decimal(str(round(dti, 2)))
        credit_score.total_credit_limit = Decimal(str(round(total_limit, 2)))
        credit_score.total_credit_used = Decimal(str(round(total_used, 2)))
        credit_score.monthly_income = Decimal(str(round(estimated_income, 2)))
        credit_score.monthly_debt_payment = Decimal(str(round(monthly_debt_payment, 2)))

        self.db.commit()
        self.db.refresh(credit_score)

        return credit_score
