"""Tests for the TSP retirement projection simulator."""
import pytest
from decimal import Decimal
from datetime import date
from unittest.mock import MagicMock, patch

from app.services.tsp_simulator import (
    calculate_brs_match,
    get_fund_historical_returns,
    get_weighted_return,
    project_tsp_balance,
    compare_scenarios,
    TSP_ANNUAL_LIMIT,
    TSP_CATCH_UP_LIMIT,
    TSP_TOTAL_LIMIT_50_PLUS,
)
from app.models import TSPScenario, TSPFundHistory


class TestCalculateBRSMatch:
    """Tests for BRS matching logic."""

    def test_zero_contribution_gets_automatic_1_pct(self):
        result = calculate_brs_match(Decimal("0"))
        assert result == Decimal("1")

    def test_negative_contribution_gets_automatic_1_pct(self):
        result = calculate_brs_match(Decimal("-1"))
        assert result == Decimal("1")

    def test_1_pct_contribution(self):
        # 1% auto + 1% dollar-for-dollar = 2%
        result = calculate_brs_match(Decimal("1"))
        assert result == Decimal("2")

    def test_3_pct_contribution(self):
        # 1% auto + 3% match = 4%
        result = calculate_brs_match(Decimal("3"))
        assert result == Decimal("4")

    def test_4_pct_contribution(self):
        # 1% auto + 3% match + 0.5% (50% of 1%) = 4.5%
        result = calculate_brs_match(Decimal("4"))
        assert result == Decimal("4.5")

    def test_5_pct_contribution_max_match(self):
        # 1% auto + 3% match + 1% (50% of 2%) = 5%
        result = calculate_brs_match(Decimal("5"))
        assert result == Decimal("5")

    def test_above_5_pct_no_additional_match(self):
        # Above 5% doesn't increase match
        result = calculate_brs_match(Decimal("10"))
        assert result == Decimal("5")

    def test_fractional_contribution(self):
        # 2.5% -> 1% auto + 2.5% match = 3.5%
        result = calculate_brs_match(Decimal("2.5"))
        assert result == Decimal("3.5")

    def test_3_5_pct_contribution(self):
        # 1% auto + 3% match + 0.25% (50% of 0.5%) = 4.25%
        result = calculate_brs_match(Decimal("3.5"))
        assert result == Decimal("4.25")


class TestContributionLimits:
    """Tests for TSP contribution limit constants."""

    def test_annual_limit(self):
        assert TSP_ANNUAL_LIMIT == Decimal("23000")

    def test_catch_up_limit(self):
        assert TSP_CATCH_UP_LIMIT == Decimal("7500")

    def test_total_limit_50_plus(self):
        assert TSP_TOTAL_LIMIT_50_PLUS == Decimal("30500")


class TestGetFundHistoricalReturns:
    """Tests for historical fund return calculations."""

    def test_returns_zero_with_insufficient_data(self, db):
        result = get_fund_historical_returns(db, "X", years=10)
        assert result["average_annual_return"] == Decimal("0")
        assert result["data_points"] == 0

    def test_returns_zero_with_single_data_point(self, db):
        entry = TSPFundHistory(fund="Z", date=date(2020, 1, 1), price=Decimal("10.00"))
        db.add(entry)
        db.commit()
        result = get_fund_historical_returns(db, "Z", years=10)
        assert result["data_points"] <= 1

    def test_calculates_returns_with_valid_data(self, db, sample_fund_history):
        result = get_fund_historical_returns(db, "C", years=15)
        assert result["data_points"] == 2
        assert result["fund"] == "C"
        # C fund went from 25 to 65: total return = (65-25)/25 * 100 = 160%
        assert result["total_return"] == 160.0
        assert result["average_annual_return"] > 0

    def test_cagr_is_reasonable(self, db, sample_fund_history):
        result = get_fund_historical_returns(db, "C", years=15)
        # Over ~10 years, 25 -> 65 is about 10% CAGR
        cagr = result["average_annual_return"]
        assert 5 < cagr < 15


class TestGetWeightedReturn:
    """Tests for weighted average return calculation."""

    def test_single_fund_100_pct(self, db, sample_fund_history):
        allocation = {"c": 100, "s": 0, "g": 0, "f": 0, "i": 0}
        result = get_weighted_return(db, allocation)
        # Should be the C fund's CAGR
        assert result > Decimal("0")

    def test_empty_allocation(self, db, sample_fund_history):
        allocation = {"c": 0, "s": 0, "g": 0, "f": 0, "i": 0}
        result = get_weighted_return(db, allocation)
        assert result == Decimal("0")

    def test_mixed_allocation(self, db, sample_fund_history):
        allocation = {"c": 60, "s": 30, "i": 10, "g": 0, "f": 0}
        result = get_weighted_return(db, allocation)
        assert result > Decimal("0")

    def test_l_fund_with_no_history(self, db, sample_fund_history):
        allocation = {"c": 0, "s": 0, "g": 0, "f": 0, "i": 0, "l": 100, "l_fund_year": 2050}
        result = get_weighted_return(db, allocation)
        # Falls back to estimated return for L fund with no history
        assert result > Decimal("0")

    def test_l_fund_estimate_aggressive(self, db, sample_fund_history):
        # L2060 is far out, should use aggressive estimate (8.5%)
        allocation = {"c": 0, "s": 0, "g": 0, "f": 0, "i": 0, "l": 100, "l_fund_year": 2060}
        result = get_weighted_return(db, allocation)
        assert result == Decimal("8.5")


class TestProjectTSPBalance:
    """Tests for full TSP balance projection."""

    def test_basic_projection(self, db, sample_tsp_scenario):
        result = project_tsp_balance(db, sample_tsp_scenario)
        assert result["scenario_name"] == "Base Scenario"
        assert result["final_balance"] > 50000  # Should grow from initial 50k
        assert result["total_contributions"] > 0
        assert result["total_employer_match"] > 0
        assert result["total_growth"] > 0
        assert len(result["projections"]) > 0

    def test_projection_first_year_uses_current_balance(self, db, sample_tsp_scenario):
        result = project_tsp_balance(db, sample_tsp_scenario)
        first_year = result["projections"][0]
        assert first_year["balance"] == 50000.0  # No contributions in year 0

    def test_contributions_increase_balance(self, db, sample_tsp_scenario):
        result = project_tsp_balance(db, sample_tsp_scenario)
        # Balance should increase year over year
        balances = [p["balance"] for p in result["projections"]]
        for i in range(1, len(balances)):
            assert balances[i] > balances[i - 1]

    def test_employer_match_included(self, db, sample_tsp_scenario):
        result = project_tsp_balance(db, sample_tsp_scenario)
        # At 5% contribution, BRS match should be 5%
        assert result["total_employer_match"] > 0
        second_year = result["projections"][1]
        assert second_year["employer_match"] > 0

    def test_contribution_limit_under_50(self, db, sample_tsp_scenario):
        # Person born 1990, contribution at 100% of $60k pay = $60k > $23k limit
        sample_tsp_scenario.contribution_pct = Decimal("100")
        db.commit()
        result = project_tsp_balance(db, sample_tsp_scenario)
        second_year = result["projections"][1]
        assert second_year["contribution"] <= float(TSP_ANNUAL_LIMIT)

    def test_contribution_limit_over_50(self, db, sample_tsp_scenario):
        # Person born 1970, now ~55, should get catch-up limit
        sample_tsp_scenario.birth_year = 1970
        sample_tsp_scenario.contribution_pct = Decimal("100")
        db.commit()
        result = project_tsp_balance(db, sample_tsp_scenario)
        second_year = result["projections"][1]
        assert second_year["contribution"] <= float(TSP_TOTAL_LIMIT_50_PLUS)

    def test_pay_increases_annually(self, db, sample_tsp_scenario):
        result = project_tsp_balance(db, sample_tsp_scenario)
        first_pay = result["projections"][0]["base_pay"]
        second_pay = result["projections"][1]["base_pay"]
        # 2% increase
        assert second_pay == pytest.approx(first_pay * 1.02, rel=0.001)

    def test_custom_projection_years(self, db, sample_tsp_scenario):
        result = project_tsp_balance(db, sample_tsp_scenario, projection_years=10)
        assert result["years_projected"] <= 15  # min(10, years_to_retirement + 5)

    def test_zero_balance_start(self, db, sample_tsp_scenario):
        sample_tsp_scenario.current_balance = Decimal("0")
        db.commit()
        result = project_tsp_balance(db, sample_tsp_scenario)
        assert result["final_balance"] > 0  # Should grow from contributions alone

    def test_no_birth_year_uses_default(self, db, sample_tsp_scenario):
        sample_tsp_scenario.birth_year = None
        db.commit()
        result = project_tsp_balance(db, sample_tsp_scenario, projection_years=20)
        assert len(result["projections"]) > 0


class TestCompareScenarios:
    """Tests for scenario comparison."""

    def test_compare_single_scenario(self, db, sample_tsp_scenario):
        result = compare_scenarios(db, [sample_tsp_scenario.id])
        assert len(result["scenarios"]) == 1
        assert len(result["comparison"]) > 0

    def test_compare_nonexistent_scenario(self, db):
        result = compare_scenarios(db, [999])
        assert len(result["scenarios"]) == 0
        assert len(result["comparison"]) == 0

    def test_compare_multiple_scenarios(self, db, sample_profile):
        s1 = TSPScenario(
            profile_id=sample_profile.id, name="Low", current_balance=Decimal("10000"),
            contribution_pct=Decimal("3"), base_pay=Decimal("50000"),
            annual_pay_increase_pct=Decimal("2"), use_historical_returns=False,
            custom_annual_return_pct=Decimal("5"), retirement_age=60, birth_year=1990,
            allocation_g=Decimal("0"), allocation_f=Decimal("0"), allocation_c=Decimal("60"),
            allocation_s=Decimal("30"), allocation_i=Decimal("10"), allocation_l=Decimal("0"),
        )
        s2 = TSPScenario(
            profile_id=sample_profile.id, name="High", current_balance=Decimal("50000"),
            contribution_pct=Decimal("10"), base_pay=Decimal("80000"),
            annual_pay_increase_pct=Decimal("3"), use_historical_returns=False,
            custom_annual_return_pct=Decimal("9"), retirement_age=60, birth_year=1990,
            allocation_g=Decimal("0"), allocation_f=Decimal("0"), allocation_c=Decimal("60"),
            allocation_s=Decimal("30"), allocation_i=Decimal("10"), allocation_l=Decimal("0"),
        )
        db.add_all([s1, s2])
        db.commit()

        result = compare_scenarios(db, [s1.id, s2.id])
        assert len(result["scenarios"]) == 2
        # Higher contributions + higher pay + higher return should yield bigger balance
        high_balance = result["scenarios"][1]["final_balance"]
        low_balance = result["scenarios"][0]["final_balance"]
        assert high_balance > low_balance
