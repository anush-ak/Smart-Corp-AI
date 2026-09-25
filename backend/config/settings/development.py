"""Development settings — local workstation / classroom demo."""

from .base import *  # noqa: F401,F403

DEBUG = True
# Dev server runs behind proxied preview hosts; allow all (never in prod).
ALLOWED_HOSTS = ["*"]
DEMO_ENDPOINTS_ENABLED = True
ENABLE_API_DOCS = True
CELERY_TASK_ALWAYS_EAGER = True
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = [  # noqa: F405
    "rest_framework.renderers.JSONRenderer",
    "rest_framework.renderers.BrowsableAPIRenderer",
]
