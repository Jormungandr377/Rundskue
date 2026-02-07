"""Tests for notification endpoints."""
import pytest
from app.models import Notification


class TestNotifications:
    def test_list_empty(self, client, auth_headers):
        response = client.get("/api/notifications/", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []

    def test_unread_count(self, client, auth_headers):
        response = client.get("/api/notifications/unread-count", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["count"] == 0

    def test_mark_all_read(self, client, auth_headers, test_user, db):
        notif = Notification(
            user_id=test_user.id,
            type="budget_alert",
            title="Test Alert",
            message="Test message",
        )
        db.add(notif)
        db.commit()

        response = client.get("/api/notifications/unread-count", headers=auth_headers)
        assert response.json()["count"] == 1

        response = client.put("/api/notifications/read-all", headers=auth_headers)
        assert response.status_code == 200

        response = client.get("/api/notifications/unread-count", headers=auth_headers)
        assert response.json()["count"] == 0

    def test_check_budgets(self, client, auth_headers):
        response = client.post("/api/notifications/check-budgets", headers=auth_headers)
        assert response.status_code == 200
        assert "alerts_created" in response.json()

    def test_check_bills(self, client, auth_headers):
        response = client.post("/api/notifications/check-bills", headers=auth_headers)
        assert response.status_code == 200
        assert "reminders_created" in response.json()
