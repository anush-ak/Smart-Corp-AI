"""App config for ai (scaffold — enable in INSTALLED_APPS in its phase)."""

from django.apps import AppConfig


class AiConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.ai"
