"""App config for workflows (scaffold — enable in INSTALLED_APPS in its phase)."""

from django.apps import AppConfig


class WorkflowsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.workflows"
