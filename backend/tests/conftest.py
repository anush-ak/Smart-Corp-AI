"""Shared pytest fixtures: organisations, role users, API clients."""

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import RoleChoices, User
from apps.organizations.models import Department, Organization

PASSWORD = "TestPass123!"


@pytest.fixture(autouse=True)
def _clear_cache():
    """Isolate throttle/rate-limit state between tests."""
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def org_a(db):
    return Organization.objects.create(
        name="Org A", slug="org-a", domain="a.example", plan="enterprise"
    )


@pytest.fixture
def org_b(db):
    return Organization.objects.create(
        name="Org B", slug="org-b", domain="b.example", plan="business"
    )


@pytest.fixture
def dept_a(org_a):
    return Department.objects.create(
        organization=org_a, name="Engineering", description="Eng"
    )


@pytest.fixture
def dept_b(org_b):
    return Department.objects.create(
        organization=org_b, name="Engineering", description="Eng"
    )


def _make_user(email, role, organization, department=None, **extra):
    return User.objects.create_user(
        email=email,
        password=PASSWORD,
        first_name=role.title(),
        last_name="User",
        organization=organization,
        department=department,
        role=role,
        job_title=f"{role.title()} job",
        **extra,
    )


@pytest.fixture
def owner_a(org_a, dept_a):
    return _make_user("owner@a.example", RoleChoices.OWNER, org_a, dept_a)


@pytest.fixture
def admin_a(org_a, dept_a):
    return _make_user("admin@a.example", RoleChoices.ADMIN, org_a, dept_a)


@pytest.fixture
def hr_a(org_a, dept_a):
    return _make_user("hr@a.example", RoleChoices.HR, org_a, dept_a)


@pytest.fixture
def manager_a(org_a, dept_a):
    return _make_user("manager@a.example", RoleChoices.MANAGER, org_a, dept_a)


@pytest.fixture
def employee_a(org_a, dept_a):
    return _make_user("employee@a.example", RoleChoices.EMPLOYEE, org_a, dept_a)


@pytest.fixture
def owner_b(org_b, dept_b):
    return _make_user("owner@b.example", RoleChoices.OWNER, org_b, dept_b)


@pytest.fixture
def employee_b(org_b, dept_b):
    return _make_user("employee@b.example", RoleChoices.EMPLOYEE, org_b, dept_b)


def _client_for(user):
    client = APIClient()
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.access_token}")
    return client


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def owner_client(owner_a):
    return _client_for(owner_a)


@pytest.fixture
def admin_client(admin_a):
    return _client_for(admin_a)


@pytest.fixture
def hr_client(hr_a):
    return _client_for(hr_a)


@pytest.fixture
def manager_client(manager_a):
    return _client_for(manager_a)


@pytest.fixture
def employee_client(employee_a):
    return _client_for(employee_a)


@pytest.fixture
def owner_b_client(owner_b):
    return _client_for(owner_b)


@pytest.fixture
def auth_client():
    """Factory: auth_client(user) -> authenticated APIClient."""
    return _client_for
