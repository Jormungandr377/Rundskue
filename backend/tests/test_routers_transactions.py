"""Tests for the transactions API router."""
import pytest
from app.models import Category


class TestGetTransactions:
    def test_list_transactions(self, client, sample_transactions):
        response = client.get("/api/transactions/")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] > 0
        assert len(data["transactions"]) > 0

    def test_filter_by_profile(self, client, sample_transactions, sample_accounts):
        profile_id = sample_accounts["Checking"].profile_id
        response = client.get(f"/api/transactions/?profile_id={profile_id}")
        assert response.status_code == 200
        assert response.json()["total"] > 0

    def test_filter_by_account(self, client, sample_transactions, sample_accounts):
        acc_id = sample_accounts["Checking"].id
        response = client.get(f"/api/transactions/?account_id={acc_id}")
        assert response.status_code == 200
        for txn in response.json()["transactions"]:
            assert txn["account_id"] == acc_id

    def test_filter_by_date_range(self, client, sample_transactions):
        response = client.get("/api/transactions/?start_date=2025-01-10&end_date=2025-01-20")
        assert response.status_code == 200
        for txn in response.json()["transactions"]:
            assert "2025-01-10" <= txn["date"] <= "2025-01-20"

    def test_search_by_name(self, client, sample_transactions):
        response = client.get("/api/transactions/?search=Netflix")
        assert response.status_code == 200
        assert response.json()["total"] >= 1

    def test_filter_by_amount_range(self, client, sample_transactions):
        response = client.get("/api/transactions/?min_amount=40&max_amount=100")
        assert response.status_code == 200
        for txn in response.json()["transactions"]:
            assert 40 <= txn["amount"] <= 100

    def test_exclude_excluded_by_default(self, client, sample_transactions):
        response = client.get("/api/transactions/")
        data = response.json()
        for txn in data["transactions"]:
            assert txn["is_excluded"] is False

    def test_include_excluded(self, client, sample_transactions):
        response = client.get("/api/transactions/?include_excluded=true")
        data = response.json()
        has_excluded = any(t["is_excluded"] for t in data["transactions"])
        assert has_excluded

    def test_exclude_transfers(self, client, sample_transactions):
        response = client.get("/api/transactions/?include_transfers=false")
        for txn in response.json()["transactions"]:
            assert txn["is_transfer"] is False

    def test_pagination(self, client, sample_transactions):
        response = client.get("/api/transactions/?page=1&page_size=2")
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 2
        assert len(data["transactions"]) <= 2
        assert data["total_pages"] >= 1

    def test_pagination_page_2(self, client, sample_transactions):
        r1 = client.get("/api/transactions/?page=1&page_size=2")
        r2 = client.get("/api/transactions/?page=2&page_size=2")
        ids1 = {t["id"] for t in r1.json()["transactions"]}
        ids2 = {t["id"] for t in r2.json()["transactions"]}
        assert ids1.isdisjoint(ids2)  # No overlap


class TestGetSingleTransaction:
    def test_get_transaction(self, client, sample_transactions):
        txn_id = sample_transactions[0].id
        response = client.get(f"/api/transactions/{txn_id}")
        assert response.status_code == 200
        assert response.json()["id"] == txn_id

    def test_get_nonexistent(self, client):
        response = client.get("/api/transactions/999")
        assert response.status_code == 404


class TestUpdateTransaction:
    def test_update_category(self, client, db, sample_transactions, sample_categories):
        txn_id = sample_transactions[0].id
        new_cat = sample_categories["Restaurants"].id
        response = client.put(f"/api/transactions/{txn_id}", json={
            "category_id": new_cat,
        })
        assert response.status_code == 200
        assert response.json()["category_id"] == new_cat

    def test_update_custom_name(self, client, sample_transactions):
        txn_id = sample_transactions[0].id
        response = client.put(f"/api/transactions/{txn_id}", json={
            "custom_name": "My Custom Name",
        })
        assert response.status_code == 200
        assert response.json()["custom_name"] == "My Custom Name"

    def test_update_notes(self, client, sample_transactions):
        txn_id = sample_transactions[0].id
        response = client.put(f"/api/transactions/{txn_id}", json={
            "notes": "A test note",
        })
        assert response.status_code == 200
        assert response.json()["notes"] == "A test note"

    def test_mark_as_excluded(self, client, sample_transactions):
        txn_id = sample_transactions[0].id
        response = client.put(f"/api/transactions/{txn_id}", json={
            "is_excluded": True,
        })
        assert response.status_code == 200
        assert response.json()["is_excluded"] is True

    def test_mark_as_transfer(self, client, sample_transactions):
        txn_id = sample_transactions[0].id
        response = client.put(f"/api/transactions/{txn_id}", json={
            "is_transfer": True,
        })
        assert response.status_code == 200
        assert response.json()["is_transfer"] is True

    def test_invalid_category(self, client, sample_transactions):
        txn_id = sample_transactions[0].id
        response = client.put(f"/api/transactions/{txn_id}", json={
            "category_id": 99999,
        })
        assert response.status_code == 400


class TestBulkCategorize:
    def test_bulk_categorize(self, client, sample_transactions, sample_categories):
        ids = [sample_transactions[0].id, sample_transactions[2].id]
        cat_id = sample_categories["Streaming"].id
        response = client.post(
            f"/api/transactions/bulk-categorize?category_id={cat_id}",
            json=ids,
        )
        assert response.status_code == 200
        assert response.json()["updated"] == 2


class TestCategories:
    def test_list_categories(self, client, sample_categories):
        response = client.get("/api/transactions/categories")
        assert response.status_code == 200
        names = [c["name"] for c in response.json()]
        assert "Groceries" in names

    def test_categories_hierarchy(self, client, sample_categories):
        response = client.get("/api/transactions/categories/hierarchy")
        assert response.status_code == 200
        assert len(response.json()) > 0


class TestSearchMerchants:
    def test_search_merchants(self, client, sample_transactions):
        response = client.get("/api/transactions/search/merchants?q=Whole")
        assert response.status_code == 200
        assert "Whole Foods Market" in response.json()

    def test_search_no_results(self, client, sample_transactions):
        response = client.get("/api/transactions/search/merchants?q=XYZNONEXISTENT")
        assert response.status_code == 200
        assert len(response.json()) == 0
