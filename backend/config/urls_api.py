"""Versioned API routes (mounted at both /api/v1/ and legacy /api/)."""

from django.urls import include, path

urlpatterns = [
    path("auth/", include("apps.accounts.urls_auth")),
    path("users/", include("apps.accounts.urls_users")),
    path("organizations/", include("apps.organizations.urls_organizations")),
    path("departments/", include("apps.organizations.urls_departments")),
]
