"""Tests for session management endpoints."""
import pytest


class TestSessions:
    def test_list_sessions(self, client, auth_headers):
        response = client.get("/api/sessions/", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_revoke_nonexistent_session(self, client, auth_headers):
        response = client.delete("/api/sessions/99999", headers=auth_headers)
        assert response.status_code == 404

    def test_revoke_all_other_sessions(self, client, auth_headers):
        response = client.delete("/api/sessions/", headers=auth_headers)
        assert response.status_code == 200
        assert "Revoked" in response.json()["message"]
