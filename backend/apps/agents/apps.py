"""App config for agents (scaffold — enable in INSTALLED_APPS in its phase)."""

from django.apps import AppConfig


class AgentsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.agents"
