"""App config for notifications (scaffold — enable in INSTALLED_APPS in its phase)."""

from django.apps import AppConfig


class NotificationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.notifications"
