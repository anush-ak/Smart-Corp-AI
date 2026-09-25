"""App config for meetings (scaffold — enable in INSTALLED_APPS in its phase)."""

from django.apps import AppConfig


class MeetingsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.meetings"
