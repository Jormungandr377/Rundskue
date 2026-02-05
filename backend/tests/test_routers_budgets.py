"""Tests for the budgets API router."""
import pytest
from datetime import date

from app.models import Budget, BudgetItem


class TestGetBudgets:
    def test_list_budgets(self, client, db, sample_profile, sample_categories):
        # Create a budget
        budget = Budget(
            profile_id=sample_profile.id,
            name="January 2025",
            month=date(2025, 1, 1),
        )
        db.add(budget)
        db.flush()
        item = BudgetItem(
            budget_id=budget.id,
            category_id=sample_categories["Groceries"].id,
            amount=500,
        )
        db.add(item)
        db.commit()

        response = client.get(f"/api/budgets/?profile_id={sample_profile.id}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "January 2025"
        assert data[0]["total_budgeted"] == 500.0

    def test_filter_by_month(self, client, db, sample_profile, sample_categories):
        for m, name in [(1, "Jan"), (2, "Feb")]:
            b = Budget(profile_id=sample_profile.id, name=name, month=date(2025, m, 1))
            db.add(b)
        db.commit()

        response = client.get(f"/api/budgets/?profile_id={sample_profile.id}&year=2025&month=1")
        assert response.status_code == 200
        assert len(response.json()) == 1
        assert response.json()[0]["name"] == "Jan"


class TestCreateBudget:
    def test_create_budget(self, client, sample_profile, sample_categories):
        response = client.post("/api/budgets/", json={
            "profile_id": sample_profile.id,
            "name": "March 2025",
            "month": "2025-03-01",
            "items": [
                {"category_id": sample_categories["Groceries"].id, "amount": 600},
                {"category_id": sample_categories["Restaurants"].id, "amount": 200},
            ],
        })
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "March 2025"
        assert data["total_budgeted"] == 800.0
        assert len(data["items"]) == 2

    def test_duplicate_month_rejected(self, client, db, sample_profile, sample_categories):
        Budget.__table__.create(bind=db.get_bind(), checkfirst=True)
        # Create first budget
        client.post("/api/budgets/", json={
            "profile_id": sample_profile.id,
            "name": "April 2025",
            "month": "2025-04-01",
            "items": [{"category_id": sample_categories["Groceries"].id, "amount": 100}],
        })
        # Attempt duplicate
        response = client.post("/api/budgets/", json={
            "profile_id": sample_profile.id,
            "name": "April 2025 v2",
            "month": "2025-04-01",
            "items": [{"category_id": sample_categories["Groceries"].id, "amount": 200}],
        })
        assert response.status_code == 400


class TestUpdateBudget:
    def test_update_budget_items(self, client, db, sample_profile, sample_categories):
        budget = Budget(
            profile_id=sample_profile.id, name="Test", month=date(2025, 5, 1)
        )
        db.add(budget)
        db.flush()
        db.add(BudgetItem(budget_id=budget.id, category_id=sample_categories["Groceries"].id, amount=100))
        db.commit()

        response = client.put(f"/api/budgets/{budget.id}", json=[
            {"category_id": sample_categories["Restaurants"].id, "amount": 300},
        ])
        assert response.status_code == 200
        assert len(response.json()["items"]) == 1
        assert response.json()["total_budgeted"] == 300.0


class TestDeleteBudget:
    def test_delete_budget(self, client, db, sample_profile):
        budget = Budget(
            profile_id=sample_profile.id, name="Delete Me", month=date(2025, 6, 1)
        )
        db.add(budget)
        db.commit()

        response = client.delete(f"/api/budgets/{budget.id}")
        assert response.status_code == 200
        assert response.json()["status"] == "deleted"

    def test_delete_nonexistent(self, client):
        response = client.delete("/api/budgets/999")
        assert response.status_code == 404


class TestBudgetSummary:
    def test_summary_with_budget(self, client, db, sample_profile, sample_categories, sample_transactions):
        budget = Budget(
            profile_id=sample_profile.id, name="Jan", month=date(2025, 1, 1)
        )
        db.add(budget)
        db.flush()
        db.add(BudgetItem(budget_id=budget.id, category_id=sample_categories["Groceries"].id, amount=200))
        db.commit()

        response = client.get(
            f"/api/budgets/summary?profile_id={sample_profile.id}&year=2025&month=1"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_budgeted"] == 200.0
        assert data["total_income"] > 0  # Salary transaction exists

    def test_summary_without_budget(self, client, sample_profile, sample_transactions):
        response = client.get(
            f"/api/budgets/summary?profile_id={sample_profile.id}&year=2025&month=1"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total_budgeted"] == 0


class TestCopyFromTemplate:
    def test_copy_from_template(self, client, db, sample_profile, sample_categories):
        template = Budget(
            profile_id=sample_profile.id, name="Template", month=date(2025, 1, 1),
            is_template=True,
        )
        db.add(template)
        db.flush()
        db.add(BudgetItem(budget_id=template.id, category_id=sample_categories["Groceries"].id, amount=500))
        db.commit()

        response = client.post(
            f"/api/budgets/copy-from-template?profile_id={sample_profile.id}"
            f"&target_year=2025&target_month=7"
        )
        assert response.status_code == 200
        assert response.json()["status"] == "created"

    def test_copy_no_template(self, client, sample_profile):
        response = client.post(
            f"/api/budgets/copy-from-template?profile_id={sample_profile.id}"
            f"&target_year=2025&target_month=8"
        )
        assert response.status_code == 404
