"""Production settings — strict secrets, PostgreSQL, hardened headers."""

import os
from urllib.parse import urlparse

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401,F403

DEBUG = False
DEMO_ENDPOINTS_ENABLED = False  # never available in production

render_hostname = os.environ.get("RENDER_EXTERNAL_HOSTNAME", "").strip()
if render_hostname and render_hostname not in ALLOWED_HOSTS:  # noqa: F405
    ALLOWED_HOSTS = [*ALLOWED_HOSTS, render_hostname]  # noqa: F405

if not SECRET_KEY or SECRET_KEY == "dev-insecure-change-me-before-production":  # noqa: F405
    raise ImproperlyConfigured(
        "DJANGO_SECRET_KEY must be set to a strong random value in production."
    )
if DATABASE_URL.startswith("sqlite"):  # noqa: F405
    raise ImproperlyConfigured("DATABASE_URL must point at PostgreSQL in production.")
if not ALLOWED_HOSTS:  # noqa: F405
    raise ImproperlyConfigured("DJANGO_ALLOWED_HOSTS must be set in production.")

parsed_frontend = urlparse(FRONTEND_URL)  # noqa: F405
if (
    FRONTEND_URL  # noqa: F405
    and parsed_frontend.scheme in {"http", "https"}
    and parsed_frontend.hostname not in {None, "localhost", "127.0.0.1", "::1"}
):
    frontend_origin = f"{parsed_frontend.scheme}://{parsed_frontend.netloc}"
    if frontend_origin not in CORS_ALLOWED_ORIGINS:  # noqa: F405
        CORS_ALLOWED_ORIGINS = [*CORS_ALLOWED_ORIGINS, frontend_origin]  # noqa: F405
    if frontend_origin not in CSRF_TRUSTED_ORIGINS:  # noqa: F405
        CSRF_TRUSTED_ORIGINS = [*CSRF_TRUSTED_ORIGINS, frontend_origin]  # noqa: F405

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
