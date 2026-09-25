"""App config for evaluations (scaffold — enable in INSTALLED_APPS in its phase)."""

from django.apps import AppConfig


class EvaluationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.evaluations"
