"""App config for rag (scaffold — enable in INSTALLED_APPS in its phase)."""

from django.apps import AppConfig


class RagConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.rag"
