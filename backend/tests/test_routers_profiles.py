"""Tests for the profiles API router."""
import pytest


class TestGetProfiles:
    def test_list_profiles(self, client, sample_profile):
        response = client.get("/api/profiles/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert data[0]["name"] == "Test User"

    def test_get_single_profile(self, client, sample_profile):
        response = client.get(f"/api/profiles/{sample_profile.id}")
        assert response.status_code == 200
        assert response.json()["email"] == "test@example.com"

    def test_get_nonexistent_profile(self, client):
        response = client.get("/api/profiles/999")
        assert response.status_code == 404


class TestCreateProfile:
    def test_create_profile(self, client):
        response = client.post("/api/profiles/", json={
            "name": "New User",
            "email": "new@example.com",
        })
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "New User"
        assert data["id"] is not None

    def test_create_primary_profile_unmarks_others(self, client, sample_profile):
        response = client.post("/api/profiles/", json={
            "name": "Primary User",
            "is_primary": True,
        })
        assert response.status_code == 200
        # Original should no longer be primary
        original = client.get(f"/api/profiles/{sample_profile.id}").json()
        assert original["is_primary"] is False


class TestUpdateProfile:
    def test_update_profile_name(self, client, sample_profile):
        response = client.put(f"/api/profiles/{sample_profile.id}", json={
            "name": "Updated Name",
        })
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Name"

    def test_update_nonexistent(self, client):
        response = client.put("/api/profiles/999", json={"name": "X"})
        assert response.status_code == 404


class TestDeleteProfile:
    def test_delete_profile(self, client, sample_profile):
        response = client.delete(f"/api/profiles/{sample_profile.id}")
        assert response.status_code == 200
        # Should be gone
        response = client.get(f"/api/profiles/{sample_profile.id}")
        assert response.status_code == 404

    def test_delete_nonexistent(self, client):
        response = client.delete("/api/profiles/999")
        assert response.status_code == 404
