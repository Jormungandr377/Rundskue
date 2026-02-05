"""Tests for the Plaid API router."""
import pytest
from unittest.mock import patch, MagicMock


class TestListItems:
    def test_list_items(self, client, sample_plaid_item):
        response = client.get("/api/plaid/items")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert data[0]["institution_name"] == "Test Bank"
        assert data[0]["is_active"] is True

    def test_list_items_by_profile(self, client, sample_plaid_item):
        profile_id = sample_plaid_item.profile_id
        response = client.get(f"/api/plaid/items?profile_id={profile_id}")
        assert response.status_code == 200
        assert len(response.json()) == 1


class TestDeleteItem:
    def test_delete_item(self, client, sample_plaid_item):
        response = client.delete(f"/api/plaid/items/{sample_plaid_item.id}")
        assert response.status_code == 200
        assert response.json()["status"] == "deleted"

    def test_delete_nonexistent(self, client):
        response = client.delete("/api/plaid/items/999")
        assert response.status_code == 404


class TestLinkToken:
    @patch("app.routers.plaid.create_link_token")
    def test_create_link_token(self, mock_create, client, sample_profile):
        mock_create.return_value = {
            "link_token": "link-sandbox-abc123",
            "expiration": "2025-01-01T00:00:00Z",
        }
        response = client.post("/api/plaid/link-token", json={
            "profile_id": sample_profile.id,
        })
        assert response.status_code == 200
        assert response.json()["link_token"] == "link-sandbox-abc123"

    def test_link_token_nonexistent_profile(self, client):
        response = client.post("/api/plaid/link-token", json={
            "profile_id": 999,
        })
        assert response.status_code == 404


class TestSync:
    @patch("app.routers.plaid.sync_transactions")
    def test_sync_all(self, mock_sync, client, sample_plaid_item):
        mock_sync.return_value = {"added": 3, "modified": 1, "removed": 0}
        response = client.post("/api/plaid/sync")
        assert response.status_code == 200
        data = response.json()
        assert data["transactions_added"] == 3

    @patch("app.routers.plaid.sync_transactions")
    def test_sync_single_item(self, mock_sync, client, sample_plaid_item):
        mock_sync.return_value = {"added": 2, "modified": 0, "removed": 1}
        response = client.post(f"/api/plaid/sync?item_id={sample_plaid_item.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["items_synced"] == 1

    def test_sync_nonexistent_item(self, client):
        response = client.post("/api/plaid/sync?item_id=999")
        assert response.status_code == 404
