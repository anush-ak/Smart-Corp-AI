"""User routes: /api/v1/users/... (and legacy /api/users/...)."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views_auth import RolesView
from .views_users import UserViewSet

router = DefaultRouter()
router.register(r"", UserViewSet, basename="user")

urlpatterns = [
    # NOTE: roles/ must precede the router — the "" prefix would otherwise
    # swallow it as a detail lookup.
    path("roles/", RolesView.as_view(), name="user-roles"),
    path("", include(router.urls)),
]
