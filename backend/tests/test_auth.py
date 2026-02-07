"""Tests for authentication endpoints."""
import pytest


class TestRegister:
    def test_register_success(self, client, api_headers):
        response = client.post("/api/auth/register", json={
            "email": "newuser@example.com",
            "password": "StrongPass123!",
        }, headers=api_headers)
        assert response.status_code == 201
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_register_weak_password(self, client, api_headers):
        response = client.post("/api/auth/register", json={
            "email": "weak@example.com",
            "password": "short",
        }, headers=api_headers)
        assert response.status_code == 400

    def test_register_duplicate_email(self, client, test_user, api_headers):
        response = client.post("/api/auth/register", json={
            "email": "testauth@example.com",
            "password": "AnotherPass123!",
        }, headers=api_headers)
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"]


class TestLogin:
    def test_login_success(self, client, test_user, api_headers):
        response = client.post("/api/auth/login", json={
            "email": "testauth@example.com",
            "password": "TestPass123!",
        }, headers=api_headers)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data

    def test_login_wrong_password(self, client, test_user, api_headers):
        response = client.post("/api/auth/login", json={
            "email": "testauth@example.com",
            "password": "WrongPass123!",
        }, headers=api_headers)
        assert response.status_code == 401


class TestMe:
    def test_get_me_authenticated(self, client, auth_headers, test_user):
        response = client.get("/api/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "testauth@example.com"

    def test_get_me_unauthenticated(self, client):
        response = client.get("/api/auth/me")
        assert response.status_code in (401, 403)


class TestCSRF:
    def test_post_without_csrf_header_blocked(self, client, auth_headers):
        """State-changing requests without X-Requested-With should be rejected."""
        headers = {k: v for k, v in auth_headers.items() if k != "X-Requested-With"}
        response = client.post("/api/auth/logout", headers=headers)
        assert response.status_code == 403
        assert "X-Requested-With" in response.json()["detail"]

    def test_get_without_csrf_header_allowed(self, client, auth_headers):
        """GET requests should not require CSRF header."""
        headers = {k: v for k, v in auth_headers.items() if k != "X-Requested-With"}
        response = client.get("/api/auth/me", headers=headers)
        assert response.status_code == 200
