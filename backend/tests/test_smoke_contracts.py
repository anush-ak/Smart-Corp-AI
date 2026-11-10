"""Strict API contract and failure-mode smoke tests."""

import pytest
from django.test import override_settings

V1 = "/api/v1"


@pytest.mark.django_db
class TestPublicAndProtectedContracts:
    def test_health_is_public_and_shape_is_stable(self, api_client):
        response = api_client.get("/health/")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
        assert response.json()["service"] == "smartcorp-api"

    def test_ready_reports_database(self, api_client):
        response = api_client.get("/ready/")
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "ready"
        assert body["checks"]["database"] == "ok"

    @pytest.mark.parametrize("method", ["get", "post", "put", "patch", "delete"])
    def test_auth_session_rejects_every_unauthenticated_method(self, api_client, method):
        response = getattr(api_client, method)(f"{V1}/auth/session/")
        assert response.status_code in {401, 405}

    def test_unknown_api_route_is_not_a_success(self, api_client):
        response = api_client.get(f"{V1}/does-not-exist/")
        assert response.status_code == 404

    def test_duplicate_user_email_is_rejected(self, owner_client, employee_a):
        response = owner_client.post(
            f"{V1}/users/",
            {"email": employee_a.email, "password": "Another123!", "role": "employee"},
            format="json",
        )
        assert response.status_code == 400

    def test_invalid_user_uuid_is_404(self, owner_client):
        response = owner_client.get(f"{V1}/users/00000000-0000-0000-0000-000000000000/")
        assert response.status_code == 404

    def test_sensitive_password_is_never_returned(self, owner_client, employee_a):
        response = owner_client.get(f"{V1}/users/{employee_a.pk}/")
        assert response.status_code == 200
        body = response.json()
        assert "password" not in body
        assert "password_hash" not in body

    def test_cross_tenant_organization_is_not_visible(self, employee_client, org_b):
        response = employee_client.get(f"{V1}/organizations/{org_b.pk}/")
        assert response.status_code in {403, 404}

    @override_settings(THROTTLE_RATES={"anon": "1/min"})
    def test_malformed_json_does_not_500(self, api_client):
        response = api_client.generic(
            "POST", f"{V1}/auth/login/", b"{not-json", content_type="application/json"
        )
        assert response.status_code in {400, 429}
        assert response.status_code != 500
