"""App config for analytics (scaffold — enable in INSTALLED_APPS in its phase)."""

from django.apps import AppConfig


class AnalyticsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.analytics"
