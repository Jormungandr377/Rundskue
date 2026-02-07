"""Tests for savings goals endpoints."""
import pytest


class TestGoalsCRUD:
    def test_list_goals_empty(self, client, auth_headers):
        response = client.get("/api/goals/", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []

    def test_create_goal(self, client, auth_headers):
        response = client.post("/api/goals/", json={
            "name": "Emergency Fund",
            "target_amount": 10000,
            "current_amount": 500,
        }, headers=auth_headers)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Emergency Fund"
        assert data["target_amount"] == 10000
        assert data["current_amount"] == 500
        assert data["progress_pct"] == 5.0
        assert data["is_completed"] is False

    def test_contribute_to_goal(self, client, auth_headers):
        create_resp = client.post("/api/goals/", json={
            "name": "Vacation",
            "target_amount": 2000,
            "current_amount": 0,
        }, headers=auth_headers)
        goal_id = create_resp.json()["id"]

        response = client.post(f"/api/goals/{goal_id}/contribute", json={
            "amount": 500,
        }, headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["current_amount"] == 500
        assert response.json()["progress_pct"] == 25.0

    def test_goal_completion_on_contribute(self, client, auth_headers):
        create_resp = client.post("/api/goals/", json={
            "name": "Small Goal",
            "target_amount": 100,
            "current_amount": 90,
        }, headers=auth_headers)
        goal_id = create_resp.json()["id"]

        response = client.post(f"/api/goals/{goal_id}/contribute", json={
            "amount": 20,
        }, headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["is_completed"] is True

    def test_delete_goal(self, client, auth_headers):
        create_resp = client.post("/api/goals/", json={
            "name": "Temp Goal",
            "target_amount": 100,
        }, headers=auth_headers)
        goal_id = create_resp.json()["id"]

        response = client.delete(f"/api/goals/{goal_id}", headers=auth_headers)
        assert response.status_code == 200

        list_resp = client.get("/api/goals/", headers=auth_headers)
        assert len(list_resp.json()) == 0

    def test_goal_not_found(self, client, auth_headers):
        response = client.get("/api/goals/99999", headers=auth_headers)
        assert response.status_code == 404
