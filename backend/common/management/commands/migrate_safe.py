"""Concurrency-safe database migration command for multi-instance deployments."""

from __future__ import annotations

import time

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import OperationalError, connection

ADVISORY_LOCK_ID = 8472910421
MAX_CONNECT_ATTEMPTS = 5
RETRY_BACKOFF_SECONDS = (1, 2, 4, 8)


class Command(BaseCommand):
    help = (
        "Run Django migrations safely on startup with connection retries and a "
        "PostgreSQL session advisory lock to prevent concurrent migration races."
    )

    def _wait_for_database(self) -> None:
        for attempt in range(1, MAX_CONNECT_ATTEMPTS + 1):
            try:
                connection.ensure_connection()
                return
            except OperationalError as exc:
                connection.close_if_unusable_or_obsolete()
                if attempt >= MAX_CONNECT_ATTEMPTS:
                    raise CommandError(
                        f"Database unreachable after {MAX_CONNECT_ATTEMPTS} attempts: {exc}"
                    ) from exc
                delay = RETRY_BACKOFF_SECONDS[min(attempt - 1, len(RETRY_BACKOFF_SECONDS) - 1)]
                self.stderr.write(
                    f"Database unavailable (attempt {attempt}/{MAX_CONNECT_ATTEMPTS}); "
                    f"retrying in {delay}s..."
                )
                time.sleep(delay)

    def handle(self, *args, **options) -> None:
        self._wait_for_database()

        verbosity = options.get("verbosity", 1)
        lock_acquired = False
        if connection.vendor == "postgresql":
            with connection.cursor() as cursor:
                cursor.execute(f"SELECT pg_advisory_lock({ADVISORY_LOCK_ID})")
            lock_acquired = True

        try:
            call_command("migrate", interactive=False, verbosity=verbosity)
        finally:
            if lock_acquired:
                with connection.cursor() as cursor:
                    cursor.execute(f"SELECT pg_advisory_unlock({ADVISORY_LOCK_ID})")
