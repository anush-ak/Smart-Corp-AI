"""Organisation routes: /api/v1/organizations/..."""

from django.urls import path

from .views import CurrentOrganizationView, OrganizationDetailView

urlpatterns = [
    path("current/", CurrentOrganizationView.as_view(), name="organization-current"),
    path("<uuid:pk>/", OrganizationDetailView.as_view(), name="organization-detail"),
]
