"""Tests for the analytics API router."""
import pytest


class TestSpendingByCategory:
    def test_default_current_month(self, client, sample_transactions):
        response = client.get("/api/analytics/spending-by-category")
        assert response.status_code == 200

    def test_custom_date_range(self, client, sample_transactions):
        response = client.get(
            "/api/analytics/spending-by-category?start_date=2025-01-01&end_date=2025-01-31"
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) > 0
        assert all("category_name" in c for c in data)
        assert all("percentage" in c for c in data)

    def test_filter_by_profile(self, client, sample_transactions, sample_accounts):
        profile_id = sample_accounts["Checking"].profile_id
        response = client.get(
            f"/api/analytics/spending-by-category?profile_id={profile_id}"
            f"&start_date=2025-01-01&end_date=2025-01-31"
        )
        assert response.status_code == 200


class TestCashFlow:
    def test_cash_flow_default(self, client, sample_transactions):
        response = client.get("/api/analytics/cash-flow")
        assert response.status_code == 200

    def test_cash_flow_custom_range(self, client, sample_transactions):
        response = client.get(
            "/api/analytics/cash-flow?start_date=2025-01-01&end_date=2025-01-31"
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_income" in data
        assert "total_expenses" in data
        assert "net_cash_flow" in data


class TestMonthlyTrends:
    def test_monthly_trends(self, client, sample_transactions):
        response = client.get("/api/analytics/monthly-trends?months=3")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestNetWorthHistory:
    def test_net_worth_history_empty(self, client):
        response = client.get("/api/analytics/net-worth-history")
        assert response.status_code == 200
        assert response.json() == []


class TestSnapshotNetWorth:
    def test_create_snapshot(self, client, sample_accounts):
        response = client.post("/api/analytics/snapshot-net-worth")
        assert response.status_code == 200
        data = response.json()
        assert "net_worth" in data
        assert data["net_worth"] == 55500.0

    def test_create_snapshot_for_profile(self, client, sample_accounts):
        profile_id = sample_accounts["Checking"].profile_id
        response = client.post(f"/api/analytics/snapshot-net-worth?profile_id={profile_id}")
        assert response.status_code == 200


class TestInsights:
    def test_insights_endpoint(self, client, sample_transactions):
        response = client.get("/api/analytics/insights")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
