"""Test settings — in-memory SQLite, eager Celery, fast password hashing."""

from .development import *  # noqa: F401,F403

DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
CELERY_TASK_ALWAYS_EAGER = True
ENABLE_API_DOCS = False
# Throttle behaviour is covered by design, not by brute force: keep the
# limiter active but effectively unlimited so suite order cannot flake.
REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] = {  # noqa: F405
    "anon": "10000/min",
    "user": "10000/min",
    "login": "10000/min",
}
LOGGING["loggers"]["smartcorp"]["level"] = "WARNING"  # noqa: F405
