"""RBAC: permission matrix + endpoint enforcement per role."""

import pytest

from services.security import get_role_permissions, has_permission
from tests.conftest import PASSWORD

V1 = "/api/v1"


@pytest.mark.django_db
class TestPermissionMatrix:
    def test_owner_has_everything(self):
        granted = get_role_permissions("OWNER")
        assert "users.delete" in granted
        assert "audit.view" in granted
        assert "ai.manage" in granted

    def test_admin_lacks_user_delete(self):
        assert "users.delete" not in get_role_permissions("ADMIN")
        assert "users.create" in get_role_permissions("ADMIN")

    def test_hr_capabilities(self):
        granted = get_role_permissions("HR")
        assert "users.view" in granted
        assert "knowledge.manage" in granted
        assert "workflows.approve" in granted
        assert "users.delete" not in granted
        assert "ai.manage" not in granted

    def test_manager_capabilities(self):
        granted = get_role_permissions("MANAGER")
        assert "users.view" in granted
        assert "analytics.view" in granted
        assert "workflows.approve" in granted
        assert "knowledge.manage" not in granted

    def test_employee_is_minimal(self):
        granted = get_role_permissions("EMPLOYEE")
        assert "ai.use" in granted
        assert "knowledge.search" in granted
        assert "users.view" not in granted
        assert "analytics.view" not in granted

    def test_inactive_users_have_no_permissions(self, employee_a):
        employee_a.is_active = False
        employee_a.save(update_fields=["is_active"])
        assert has_permission(employee_a, "ai.use") is False


@pytest.mark.django_db
class TestUserEndpointRBAC:
    def test_employee_cannot_list_users(self, employee_client):
        response = employee_client.get(f"{V1}/users/")
        assert response.status_code == 403
        assert response.json()["code"] == "permission_denied"

    def test_hr_can_list_users(self, hr_client):
        response = hr_client.get(f"{V1}/users/")
        assert response.status_code == 200
        assert response.json()["count"] >= 1

    def test_employee_can_read_own_record(self, employee_client, employee_a):
        response = employee_client.get(f"{V1}/users/{employee_a.pk}/")
        assert response.status_code == 200
        assert response.json()["email"] == employee_a.email

    def test_employee_cannot_read_peer_record(self, employee_client, manager_a):
        response = employee_client.get(f"{V1}/users/{manager_a.pk}/")
        assert response.status_code == 403

    def test_employee_cannot_create_users(self, employee_client):
        response = employee_client.post(
            f"{V1}/users/",
            {"email": "new@example.com", "password": "SomePass123!"},
            format="json",
        )
        assert response.status_code == 403

    def test_admin_can_create_employee(self, admin_client):
        response = admin_client.post(
            f"{V1}/users/",
            {
                "email": "newhire@example.com",
                "password": "SomePass123!",
                "first_name": "New",
                "role": "employee",
            },
            format="json",
        )
        assert response.status_code == 201
        assert response.json()["role"] == "EMPLOYEE"
        assert "password" not in response.json()

    def test_admin_cannot_create_owner(self, admin_client):
        response = admin_client.post(
            f"{V1}/users/",
            {"email": "fake-owner@example.com", "password": "SomePass123!", "role": "OWNER"},
            format="json",
        )
        assert response.status_code == 400

    def test_owner_can_create_owner(self, owner_client):
        response = owner_client.post(
            f"{V1}/users/",
            {"email": "owner2@example.com", "password": "SomePass123!", "role": "OWNER"},
            format="json",
        )
        assert response.status_code == 201

    def test_admin_cannot_delete_users(self, admin_client, employee_a):
        response = admin_client.delete(f"{V1}/users/{employee_a.pk}/")
        assert response.status_code == 403

    def test_owner_can_delete_employee(self, owner_client, employee_a):
        response = owner_client.delete(f"{V1}/users/{employee_a.pk}/")
        assert response.status_code == 204

    def test_cannot_delete_self(self, owner_client, owner_a):
        response = owner_client.delete(f"{V1}/users/{owner_a.pk}/")
        assert response.status_code == 400

    def test_cannot_delete_last_owner(self, owner_client, admin_client, owner_a):
        # admin_client's DELETE is blocked by permission first; use a second
        # owner to prove the last-owner guard (service-level).
        second = owner_client.post(
            f"{V1}/users/",
            {"email": "owner2@example.com", "password": "SomePass123!", "role": "OWNER"},
            format="json",
        )
        assert second.status_code == 201
        from rest_framework.test import APIClient

        from apps.accounts.models import User
        from rest_framework_simplejwt.tokens import RefreshToken

        second_user = User.objects.get(email="owner2@example.com")
        client = APIClient()
        client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(second_user).access_token}"
        )
        # Second owner deletes the first → allowed.
        assert client.delete(f"{V1}/users/{owner_a.pk}/").status_code == 204
        # Now second owner is the last owner → cannot delete themselves anyway,
        # and demoting themselves is blocked too.
        demote = client.patch(
            f"{V1}/users/{second_user.pk}/", {"role": "ADMIN"}, format="json"
        )
        assert demote.status_code == 400

    def test_cannot_change_own_role(self, admin_client, admin_a):
        response = admin_client.patch(
            f"{V1}/users/{admin_a.pk}/", {"role": "OWNER"}, format="json"
        )
        assert response.status_code == 400

    def test_scope_update_changes_role_and_scopes(self, owner_client, employee_a):
        response = owner_client.patch(
            f"{V1}/users/{employee_a.pk}/scope/",
            {"role": "manager", "knowledgeScope": ["kb_hr"], "agentScope": []},
            format="json",
        )
        assert response.status_code == 200
        assert response.json()["role"] == "manager"
        employee_a.refresh_from_db()
        assert employee_a.role == "MANAGER"
        assert employee_a.knowledge_scope == ["kb_hr"]

    def test_employee_cannot_update_scope(self, employee_client, manager_a):
        response = employee_client.patch(
            f"{V1}/users/{manager_a.pk}/scope/", {"role": "employee"}, format="json"
        )
        assert response.status_code == 403
