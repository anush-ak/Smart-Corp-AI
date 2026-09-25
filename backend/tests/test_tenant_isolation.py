"""Tenant isolation: Org A can never see or touch Org B's data."""

import pytest

V1 = "/api/v1"


@pytest.mark.django_db
class TestUserIsolation:
    def test_list_is_scoped_to_own_org(self, owner_client, owner_b):
        response = owner_client.get(f"{V1}/users/")
        assert response.status_code == 200
        emails = [row["email"] for row in response.json()["results"]]
        assert owner_b.email not in emails
        assert all(email.endswith("@a.example") for email in emails)

    def test_cross_org_detail_is_404_not_403(self, owner_client, employee_b):
        response = owner_client.get(f"{V1}/users/{employee_b.pk}/")
        assert response.status_code == 404

    def test_cross_org_update_is_404(self, owner_client, employee_b):
        response = owner_client.patch(
            f"{V1}/users/{employee_b.pk}/", {"job_title": "Hacker"}, format="json"
        )
        assert response.status_code == 404

    def test_cross_org_delete_is_404(self, owner_client, employee_b):
        response = owner_client.delete(f"{V1}/users/{employee_b.pk}/")
        assert response.status_code == 404

    def test_cross_org_scope_is_404(self, owner_client, employee_b):
        response = owner_client.patch(
            f"{V1}/users/{employee_b.pk}/scope/", {"role": "employee"}, format="json"
        )
        assert response.status_code == 404

    def test_cannot_create_user_with_other_org_department(
        self, owner_client, dept_b
    ):
        response = owner_client.post(
            f"{V1}/users/",
            {
                "email": "sneaky@example.com",
                "password": "SomePass123!",
                "department": str(dept_b.pk),
            },
            format="json",
        )
        assert response.status_code == 400


@pytest.mark.django_db
class TestOrganizationIsolation:
    def test_current_returns_own_org(self, owner_client, org_a):
        response = owner_client.get(f"{V1}/organizations/current/")
        assert response.status_code == 200
        assert response.json()["slug"] == org_a.slug

    def test_cross_org_detail_is_404(self, owner_client, org_b):
        response = owner_client.get(f"{V1}/organizations/{org_b.pk}/")
        assert response.status_code == 404

    def test_cross_org_update_is_404(self, owner_client, org_b):
        response = owner_client.patch(
            f"{V1}/organizations/{org_b.pk}/", {"name": "Hijacked"}, format="json"
        )
        assert response.status_code == 404

    def test_departments_scoped_to_own_org(self, owner_client, dept_b):
        response = owner_client.get(f"{V1}/departments/")
        assert response.status_code == 200
        ids = [row["id"] for row in response.json()["results"]]
        assert str(dept_b.pk) not in ids

    def test_cross_org_department_detail_is_404(self, owner_client, dept_b):
        response = owner_client.get(f"{V1}/departments/{dept_b.pk}/")
        assert response.status_code == 404
