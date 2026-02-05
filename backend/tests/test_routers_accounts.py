"""Tests for the accounts API router."""
import pytest


class TestGetAccounts:
    def test_list_accounts(self, client, sample_accounts):
        response = client.get("/api/accounts/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 5

    def test_filter_by_profile(self, client, sample_accounts):
        profile_id = sample_accounts["Checking"].profile_id
        response = client.get(f"/api/accounts/?profile_id={profile_id}")
        assert response.status_code == 200
        assert len(response.json()) == 5

    def test_hidden_accounts_excluded_by_default(self, client, db, sample_accounts):
        sample_accounts["Checking"].is_hidden = True
        db.commit()
        response = client.get("/api/accounts/")
        assert response.status_code == 200
        names = [a["name"] for a in response.json()]
        assert "Checking" not in names

    def test_include_hidden(self, client, db, sample_accounts):
        sample_accounts["Checking"].is_hidden = True
        db.commit()
        response = client.get("/api/accounts/?include_hidden=true")
        assert response.status_code == 200
        assert len(response.json()) == 5

    def test_get_single_account(self, client, sample_accounts):
        acc_id = sample_accounts["Checking"].id
        response = client.get(f"/api/accounts/{acc_id}")
        assert response.status_code == 200
        assert response.json()["balance_current"] == 5000.0

    def test_get_nonexistent_account(self, client):
        response = client.get("/api/accounts/999")
        assert response.status_code == 404


class TestAccountsSummary:
    def test_summary(self, client, sample_accounts):
        response = client.get("/api/accounts/summary")
        assert response.status_code == 200
        data = response.json()
        # checking(5000) + savings(15000) + investment(50000)
        assert data["total_assets"] == 70000.0
        # credit(2500) + loan(12000)
        assert data["total_liabilities"] == 14500.0
        assert data["net_worth"] == 55500.0


class TestUpdateAccount:
    def test_update_display_name(self, client, sample_accounts):
        acc_id = sample_accounts["Checking"].id
        response = client.put(f"/api/accounts/{acc_id}", json={
            "display_name": "My Checking",
        })
        assert response.status_code == 200
        assert response.json()["display_name"] == "My Checking"

    def test_hide_account(self, client, sample_accounts):
        acc_id = sample_accounts["Checking"].id
        response = client.put(f"/api/accounts/{acc_id}", json={
            "is_hidden": True,
        })
        assert response.status_code == 200
        assert response.json()["is_hidden"] is True
