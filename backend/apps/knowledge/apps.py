"""App config for knowledge (scaffold — enable in INSTALLED_APPS in its phase)."""

from django.apps import AppConfig


class KnowledgeConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.knowledge"
