"""Organisation + department management."""

import pytest

V1 = "/api/v1"


@pytest.mark.django_db
class TestOrganizations:
    def test_member_can_read_org(self, employee_client, org_a):
        response = employee_client.get(f"{V1}/organizations/{org_a.pk}/")
        assert response.status_code == 200
        assert response.json()["slug"] == org_a.slug
        assert response.json()["member_count"] >= 1

    def test_employee_cannot_update_org(self, employee_client, org_a):
        response = employee_client.patch(
            f"{V1}/organizations/{org_a.pk}/", {"industry": "X"}, format="json"
        )
        assert response.status_code == 403

    def test_admin_can_update_org(self, admin_client, org_a):
        response = admin_client.patch(
            f"{V1}/organizations/{org_a.pk}/", {"industry": "Fintech"}, format="json"
        )
        assert response.status_code == 200
        assert response.json()["industry"] == "Fintech"

    def test_admin_cannot_change_plan(self, admin_client, org_a):
        response = admin_client.patch(
            f"{V1}/organizations/{org_a.pk}/", {"plan": "free"}, format="json"
        )
        assert response.status_code == 403

    def test_owner_can_change_plan(self, owner_client, org_a):
        response = owner_client.patch(
            f"{V1}/organizations/{org_a.pk}/", {"plan": "business"}, format="json"
        )
        assert response.status_code == 200
        assert response.json()["plan"] == "business"


@pytest.mark.django_db
class TestDepartments:
    def test_member_can_list(self, employee_client):
        response = employee_client.get(f"{V1}/departments/")
        assert response.status_code == 200

    def test_employee_cannot_create(self, employee_client):
        response = employee_client.post(
            f"{V1}/departments/", {"name": "Legal"}, format="json"
        )
        assert response.status_code == 403

    def test_admin_crud(self, admin_client, manager_a):
        created = admin_client.post(
            f"{V1}/departments/",
            {
                "name": "Legal",
                "description": "Legal affairs",
                "manager_id": str(manager_a.pk),
            },
            format="json",
        )
        assert created.status_code == 201
        dept_id = created.json()["id"]
        assert created.json()["manager"]["email"] == manager_a.email

        updated = admin_client.patch(
            f"{V1}/departments/{dept_id}/", {"description": "Updated"}, format="json"
        )
        assert updated.status_code == 200

        deleted = admin_client.delete(f"{V1}/departments/{dept_id}/")
        assert deleted.status_code == 204

    def test_duplicate_name_rejected(self, admin_client, dept_a):
        response = admin_client.post(
            f"{V1}/departments/", {"name": dept_a.name}, format="json"
        )
        assert response.status_code == 400

    def test_manager_must_be_same_org(self, admin_client, employee_b):
        response = admin_client.post(
            f"{V1}/departments/",
            {"name": "Legal", "manager_id": str(employee_b.pk)},
            format="json",
        )
        assert response.status_code == 404
