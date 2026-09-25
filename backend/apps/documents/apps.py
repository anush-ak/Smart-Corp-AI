"""App config for documents (scaffold — enable in INSTALLED_APPS in its phase)."""

from django.apps import AppConfig


class DocumentsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.documents"
