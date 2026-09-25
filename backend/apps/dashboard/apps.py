"""App config for dashboard (scaffold — enable in INSTALLED_APPS in its phase)."""

from django.apps import AppConfig


class DashboardConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.dashboard"
