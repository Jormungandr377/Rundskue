"""Tests for auto-categorization rules endpoints."""
import pytest
from app.models import Category


class TestCategorizationRules:
    def test_list_rules_empty(self, client, auth_headers):
        response = client.get("/api/categorization/rules", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []

    def test_create_rule(self, client, auth_headers, db, sample_categories):
        cat = sample_categories["Groceries"]
        response = client.post("/api/categorization/rules", json={
            "category_id": cat.id,
            "match_field": "name",
            "match_type": "contains",
            "match_value": "Whole Foods",
        }, headers=auth_headers)
        assert response.status_code == 201
        data = response.json()
        assert data["match_value"] == "Whole Foods"
        assert data["category_name"] == "Groceries"

    def test_delete_rule(self, client, auth_headers, db, sample_categories):
        cat = sample_categories["Restaurants"]
        create_resp = client.post("/api/categorization/rules", json={
            "category_id": cat.id,
            "match_value": "Pizza",
        }, headers=auth_headers)
        rule_id = create_resp.json()["id"]

        response = client.delete(f"/api/categorization/rules/{rule_id}", headers=auth_headers)
        assert response.status_code == 200

    def test_apply_rules_empty(self, client, auth_headers):
        response = client.post("/api/categorization/apply", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["categorized"] == 0
