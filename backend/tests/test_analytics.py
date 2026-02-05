"""Tests for the analytics service."""
import pytest
from datetime import date
from decimal import Decimal

from app.services.analytics import (
    get_spending_by_category,
    get_cash_flow,
    get_top_merchants,
    calculate_net_worth,
    save_net_worth_snapshot,
    get_net_worth_history,
    get_period_comparison,
)
from app.models import (
    Account, AccountType, Category, Transaction, NetWorthSnapshot,
)


class TestGetSpendingByCategory:
    """Tests for spending by category aggregation."""

    def test_returns_expenses_grouped(self, db, sample_transactions, sample_accounts, sample_categories):
        result = get_spending_by_category(
            db,
            profile_id=sample_accounts["Checking"].profile_id,
            start_date=date(2025, 1, 1),
            end_date=date(2025, 1, 31),
        )
        # Should have expense categories (not salary, not transfer, not excluded)
        category_names = [r["category_name"] for r in result]
        assert "Groceries" in category_names
        assert "Restaurants" in category_names

    def test_excludes_transfers(self, db, sample_transactions, sample_accounts):
        result = get_spending_by_category(
            db,
            profile_id=sample_accounts["Checking"].profile_id,
            start_date=date(2025, 1, 1),
            end_date=date(2025, 1, 31),
            exclude_transfers=True,
        )
        for r in result:
            assert r["category_name"] != "Transfer"

    def test_excludes_income(self, db, sample_transactions, sample_accounts):
        result = get_spending_by_category(
            db,
            profile_id=sample_accounts["Checking"].profile_id,
            start_date=date(2025, 1, 1),
            end_date=date(2025, 1, 31),
            exclude_income=True,
        )
        for r in result:
            assert r["category_name"] != "Salary"

    def test_percentages_sum_to_100(self, db, sample_transactions, sample_accounts):
        result = get_spending_by_category(
            db,
            profile_id=sample_accounts["Checking"].profile_id,
            start_date=date(2025, 1, 1),
            end_date=date(2025, 1, 31),
        )
        if result:
            total_pct = sum(r["percentage"] for r in result)
            assert total_pct == pytest.approx(100.0, abs=0.5)

    def test_empty_date_range(self, db, sample_transactions, sample_accounts):
        result = get_spending_by_category(
            db,
            profile_id=sample_accounts["Checking"].profile_id,
            start_date=date(2099, 1, 1),
            end_date=date(2099, 1, 31),
        )
        assert result == []

    def test_no_profile_filter_returns_all(self, db, sample_transactions):
        result = get_spending_by_category(
            db,
            start_date=date(2025, 1, 1),
            end_date=date(2025, 1, 31),
        )
        assert len(result) > 0


class TestGetCashFlow:
    """Tests for cash flow reporting."""

    def test_returns_income_and_expenses(self, db, sample_transactions, sample_accounts):
        # Use "day" grouping since "month" uses PostgreSQL-specific date_trunc
        result = get_cash_flow(
            db,
            profile_id=sample_accounts["Checking"].profile_id,
            start_date=date(2025, 1, 1),
            end_date=date(2025, 1, 31),
            group_by="day",
        )
        assert len(result) > 0
        period = result[0]
        assert "income" in period
        assert "expenses" in period
        assert "net" in period

    def test_daily_grouping(self, db, sample_transactions, sample_accounts):
        result = get_cash_flow(
            db,
            profile_id=sample_accounts["Checking"].profile_id,
            start_date=date(2025, 1, 1),
            end_date=date(2025, 1, 31),
            group_by="day",
        )
        # Should have multiple periods (one per day with transactions)
        assert len(result) >= 1


class TestGetTopMerchants:
    """Tests for top merchants by spending."""

    def test_returns_merchants(self, db, sample_transactions, sample_accounts):
        result = get_top_merchants(
            db,
            profile_id=sample_accounts["Checking"].profile_id,
            start_date=date(2025, 1, 1),
            end_date=date(2025, 1, 31),
            limit=10,
        )
        assert len(result) > 0
        assert "merchant" in result[0]
        assert "total" in result[0]

    def test_respects_limit(self, db, sample_transactions, sample_accounts):
        result = get_top_merchants(
            db,
            profile_id=sample_accounts["Checking"].profile_id,
            start_date=date(2025, 1, 1),
            end_date=date(2025, 1, 31),
            limit=1,
        )
        assert len(result) <= 1


class TestCalculateNetWorth:
    """Tests for net worth calculation."""

    def test_calculates_from_accounts(self, db, sample_accounts):
        result = calculate_net_worth(db, profile_id=sample_accounts["Checking"].profile_id)
        # Checking(5000) + Savings(15000) = 20000 cash
        assert result["total_cash"] == 20000.0
        # Investment(50000)
        assert result["total_investments"] == 50000.0
        # Credit(2500)
        assert result["total_credit"] == 2500.0
        # Loan(12000)
        assert result["total_loans"] == 12000.0
        # Net worth = (20000+50000) - (2500+12000) = 55500
        assert result["net_worth"] == 55500.0

    def test_excludes_hidden_accounts(self, db, sample_accounts):
        sample_accounts["Checking"].is_hidden = True
        db.commit()
        result = calculate_net_worth(db, profile_id=sample_accounts["Checking"].profile_id)
        # Checking should not be included
        assert result["total_cash"] == 15000.0  # Just savings

    def test_empty_profile_returns_zeros(self, db, sample_profile):
        result = calculate_net_worth(db, profile_id=sample_profile.id)
        assert result["net_worth"] == 0.0
        assert result["total_assets"] == 0.0

    def test_breakdown_includes_all_accounts(self, db, sample_accounts):
        result = calculate_net_worth(db, profile_id=sample_accounts["Checking"].profile_id)
        assert len(result["breakdown"]) == 5


class TestSaveNetWorthSnapshot:
    """Tests for net worth snapshot creation."""

    def test_creates_new_snapshot(self, db, sample_accounts):
        profile_id = sample_accounts["Checking"].profile_id
        save_net_worth_snapshot(db, profile_id=profile_id)
        snapshot = db.query(NetWorthSnapshot).filter(
            NetWorthSnapshot.profile_id == profile_id
        ).first()
        assert snapshot is not None
        assert float(snapshot.net_worth) == 55500.0

    def test_updates_existing_snapshot_for_same_day(self, db, sample_accounts):
        profile_id = sample_accounts["Checking"].profile_id
        save_net_worth_snapshot(db, profile_id=profile_id)
        # Update balance and save again
        sample_accounts["Checking"].balance_current = Decimal("10000")
        db.commit()
        save_net_worth_snapshot(db, profile_id=profile_id)
        # Should still be one snapshot
        count = db.query(NetWorthSnapshot).filter(
            NetWorthSnapshot.profile_id == profile_id
        ).count()
        assert count == 1


class TestGetPeriodComparison:
    """Tests for period-over-period comparison."""

    def test_comparison_with_data(self, db, sample_transactions, sample_accounts):
        profile_id = sample_accounts["Checking"].profile_id
        result = get_period_comparison(
            db,
            profile_id=profile_id,
            current_start=date(2025, 1, 1),
            current_end=date(2025, 1, 31),
            previous_start=date(2024, 12, 1),
            previous_end=date(2024, 12, 31),
        )
        assert "current_total" in result
        assert "previous_total" in result
        assert "by_category" in result

    def test_comparison_with_no_previous_data(self, db, sample_transactions, sample_accounts):
        profile_id = sample_accounts["Checking"].profile_id
        result = get_period_comparison(
            db,
            profile_id=profile_id,
            current_start=date(2025, 1, 1),
            current_end=date(2025, 1, 31),
            previous_start=date(2020, 1, 1),
            previous_end=date(2020, 1, 31),
        )
        assert result["previous_total"] == 0
        # Should be 100% change or 0 depending on logic
        for cat in result["by_category"]:
            assert cat["previous_amount"] == 0

    def test_zero_previous_total_no_division_error(self, db, sample_transactions, sample_accounts):
        profile_id = sample_accounts["Checking"].profile_id
        result = get_period_comparison(
            db,
            profile_id=profile_id,
            current_start=date(2025, 1, 1),
            current_end=date(2025, 1, 31),
            previous_start=date(2020, 1, 1),
            previous_end=date(2020, 1, 31),
        )
        # Should not raise division by zero
        assert result["total_change_percentage"] == 0
