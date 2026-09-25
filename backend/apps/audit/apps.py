"""App config for audit (scaffold — enable in INSTALLED_APPS in its phase)."""

from django.apps import AppConfig


class AuditConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.audit"
