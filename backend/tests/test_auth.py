"""Authentication flows: login, refresh, logout, session, passwords."""

import pytest
from django.test import override_settings

from apps.accounts.models import User
from tests.conftest import PASSWORD

V1 = "/api/v1"


@pytest.mark.django_db
class TestLogin:
    def test_login_success_returns_token_session_and_roles(self, api_client, owner_a, org_a):
        response = api_client.post(
            f"{V1}/auth/login/",
            {"email": owner_a.email, "password": PASSWORD},
            format="json",
        )
        assert response.status_code == 200
        body = response.json()
        assert body["token"]
        assert body["access"]
        assert body["refresh"]
        assert body["user"]["email"] == owner_a.email
        assert body["user"]["role"] == "owner"
        assert body["organization"]["slug"] == org_a.slug
        assert {r["role"] for r in body["roles"]} >= {"owner", "admin", "employee"}
        assert "users.delete" in body["permissions"]
        owner_a.refresh_from_db()
        assert owner_a.last_login is not None

    def test_login_legacy_alias_works(self, api_client, owner_a):
        response = api_client.post(
            "/api/auth/login/",
            {"email": owner_a.email, "password": PASSWORD},
            format="json",
        )
        assert response.status_code == 200
        assert response.json()["user"]["email"] == owner_a.email

    def test_login_wrong_password_is_401_envelope(self, api_client, owner_a):
        response = api_client.post(
            f"{V1}/auth/login/",
            {"email": owner_a.email, "password": "wrong-password"},
            format="json",
        )
        assert response.status_code == 401
        body = response.json()
        assert body["success"] is False
        assert body["code"] == "authentication_failed"
        assert body["errors"]

    def test_login_unknown_email_same_generic_error(self, api_client):
        response = api_client.post(
            f"{V1}/auth/login/",
            {"email": "nobody@example.com", "password": "whatever123"},
            format="json",
        )
        assert response.status_code == 401
        assert response.json()["message"] == "Invalid email or password."

    def test_login_inactive_user_rejected(self, api_client, employee_a):
        employee_a.is_active = False
        employee_a.save(update_fields=["is_active"])
        response = api_client.post(
            f"{V1}/auth/login/",
            {"email": employee_a.email, "password": PASSWORD},
            format="json",
        )
        assert response.status_code == 401


@pytest.mark.django_db
class TestRefreshLogout:
    def test_refresh_rotates_and_blacklists_old_token(self, api_client, owner_a):
        login = api_client.post(
            f"{V1}/auth/login/",
            {"email": owner_a.email, "password": PASSWORD},
            format="json",
        )
        refresh = login.json()["refresh"]
        first = api_client.post(f"{V1}/auth/refresh/", {"refresh": refresh}, format="json")
        assert first.status_code == 200
        assert first.json()["access"]
        # Old refresh token was rotated → blacklisted.
        replay = api_client.post(f"{V1}/auth/refresh/", {"refresh": refresh}, format="json")
        assert replay.status_code == 401

    def test_logout_blacklists_refresh_token(self, api_client, owner_a):
        login = api_client.post(
            f"{V1}/auth/login/",
            {"email": owner_a.email, "password": PASSWORD},
            format="json",
        )
        refresh = login.json()["refresh"]
        logout = api_client.post(f"{V1}/auth/logout/", {"refresh": refresh}, format="json")
        assert logout.status_code == 200
        reuse = api_client.post(f"{V1}/auth/refresh/", {"refresh": refresh}, format="json")
        assert reuse.status_code == 401

    def test_logout_without_body_still_succeeds(self, api_client):
        response = api_client.post(f"{V1}/auth/logout/", {}, format="json")
        assert response.status_code == 200


@pytest.mark.django_db
class TestSessionAndProfile:
    def test_session_requires_auth(self, api_client):
        response = api_client.get(f"{V1}/auth/session/")
        assert response.status_code == 401

    def test_session_shape(self, employee_client, employee_a):
        response = employee_client.get(f"{V1}/auth/session/")
        assert response.status_code == 200
        body = response.json()
        assert body["user"]["email"] == employee_a.email
        assert body["organization"]["slug"] == employee_a.organization.slug
        assert "ai.use" in body["permissions"]
        assert "users.view" not in body["permissions"]
        assert "assistant:use" in body["frontend_permissions"]

    def test_me_read_and_update(self, employee_client, employee_a):
        me = employee_client.get(f"{V1}/auth/me/")
        assert me.status_code == 200
        assert me.json()["email"] == employee_a.email

        patch = employee_client.patch(
            f"{V1}/auth/me/", {"first_name": "New", "role": "OWNER"}, format="json"
        )
        assert patch.status_code == 200
        employee_a.refresh_from_db()
        assert employee_a.first_name == "New"
        # Profile endpoint can never escalate roles.
        assert employee_a.role == "EMPLOYEE"

    def test_roles_endpoint_lists_definitions(self, employee_client):
        response = employee_client.get(f"{V1}/users/roles/")
        assert response.status_code == 200
        roles = {item["role"]: item for item in response.json()}
        assert set(roles) >= {"owner", "admin", "hr", "manager", "employee"}
        assert "users:manage" in roles["owner"]["permissions"]
        assert "users:manage" not in roles["employee"]["permissions"]


@pytest.mark.django_db
class TestPasswords:
    def test_change_password(self, api_client, employee_a):
        employee_client = api_client
        login = employee_client.post(
            f"{V1}/auth/login/",
            {"email": employee_a.email, "password": PASSWORD},
            format="json",
        )
        employee_client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {login.json()['access']}"
        )
        changed = employee_client.post(
            f"{V1}/auth/change-password/",
            {"current_password": PASSWORD, "new_password": "BrandNew123!"},
            format="json",
        )
        assert changed.status_code == 200

        employee_client.credentials()
        old = employee_client.post(
            f"{V1}/auth/login/",
            {"email": employee_a.email, "password": PASSWORD},
            format="json",
        )
        assert old.status_code == 401
        new = employee_client.post(
            f"{V1}/auth/login/",
            {"email": employee_a.email, "password": "BrandNew123!"},
            format="json",
        )
        assert new.status_code == 200

    def test_change_password_wrong_current(self, employee_client):
        response = employee_client.post(
            f"{V1}/auth/change-password/",
            {"current_password": "nope", "new_password": "BrandNew123!"},
            format="json",
        )
        assert response.status_code == 400

    @override_settings(DEBUG=True)
    def test_password_reset_flow(self, api_client, employee_a):
        requested = api_client.post(
            f"{V1}/auth/password-reset/", {"email": employee_a.email}, format="json"
        )
        assert requested.status_code == 200
        # Unknown emails get the identical generic response (no enumeration).
        unknown = api_client.post(
            f"{V1}/auth/password-reset/", {"email": "ghost@example.com"}, format="json"
        )
        assert unknown.status_code == 200
        assert unknown.json()["detail"] == requested.json()["detail"]

        debug = requested.json().get("debug")
        assert debug and debug["uid"] and debug["token"]
        confirmed = api_client.post(
            f"{V1}/auth/password-reset/confirm/",
            {"uid": debug["uid"], "token": debug["token"], "new_password": "Reset12345!"},
            format="json",
        )
        assert confirmed.status_code == 200
        login = api_client.post(
            f"{V1}/auth/login/",
            {"email": employee_a.email, "password": "Reset12345!"},
            format="json",
        )
        assert login.status_code == 200

    def test_password_reset_bad_token_rejected(self, api_client):
        response = api_client.post(
            f"{V1}/auth/password-reset/confirm/",
            {"uid": "bad", "token": "bad", "new_password": "Reset12345!"},
            format="json",
        )
        assert response.status_code == 400

    @override_settings(DEBUG=True)
    def test_email_verification_flow(self, employee_client, employee_a):
        assert employee_a.is_email_verified is False
        requested = employee_client.post(f"{V1}/auth/verify-email/", {}, format="json")
        assert requested.status_code == 200
        token = requested.json()["debug"]["token"]
        confirmed = employee_client.post(
            f"{V1}/auth/verify-email/confirm/", {"token": token}, format="json"
        )
        assert confirmed.status_code == 200
        employee_a.refresh_from_db()
        assert employee_a.is_email_verified is True
