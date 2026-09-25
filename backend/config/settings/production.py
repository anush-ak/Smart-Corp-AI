"""Production settings — strict secrets, PostgreSQL, hardened headers."""

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401,F403

DEBUG = False
DEMO_ENDPOINTS_ENABLED = False  # never available in production

if not SECRET_KEY or SECRET_KEY == "dev-insecure-change-me-before-production":  # noqa: F405
    raise ImproperlyConfigured(
        "DJANGO_SECRET_KEY must be set to a strong random value in production."
    )
if DATABASE_URL.startswith("sqlite"):  # noqa: F405
    raise ImproperlyConfigured("DATABASE_URL must point at PostgreSQL in production.")
if not ALLOWED_HOSTS:  # noqa: F405
    raise ImproperlyConfigured("DJANGO_ALLOWED_HOSTS must be set in production.")

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"
    },
}
