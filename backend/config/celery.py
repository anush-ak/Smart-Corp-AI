"""Celery application for SmartCorp AI.

Used from Phase 2 for document processing, embeddings, notifications and
other async work. Tasks run eagerly (in-process) in development and tests.
"""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

app = Celery("smartcorp")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
