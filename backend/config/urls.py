"""SmartCorp AI root URL configuration."""

from django.conf import settings
from django.contrib import admin
from django.urls import include, path

from common import views as common_views

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", common_views.health, name="health"),
    path("ready/", common_views.ready, name="ready"),
    # Canonical versioned API...
    path("api/v1/", include("config.urls_api")),
    # ...plus a legacy un-versioned alias kept for the current web client.
    path("api/", include("config.urls_api")),
]

if settings.ENABLE_API_DOCS:
    from drf_spectacular.views import (
        SpectacularAPIView,
        SpectacularRedocView,
        SpectacularSwaggerView,
    )

    urlpatterns += [
        path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
        path(
            "api/docs/",
            SpectacularSwaggerView.as_view(url_name="schema"),
            name="swagger-ui",
        ),
        path(
            "api/redoc/",
            SpectacularRedocView.as_view(url_name="schema"),
            name="redoc",
        ),
    ]
