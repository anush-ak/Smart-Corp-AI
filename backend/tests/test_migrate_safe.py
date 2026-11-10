"""Tests for concurrency-safe startup migrations and production settings hardening."""

from __future__ import annotations

import importlib
import runpy
import sys
from unittest.mock import MagicMock, call, patch

import pytest
from django.core.exceptions import ImproperlyConfigured
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import OperationalError, connections


def _load_production_settings() -> dict[str, object]:
    settings_pkg = importlib.import_module("config.settings")
    saved_base = sys.modules.pop("config.settings.base", None)
    saved_prod = sys.modules.pop("config.settings.production", None)
    try:
        return runpy.run_module("config.settings.production")
    finally:
        sys.modules.pop("config.settings.base", None)
        sys.modules.pop("config.settings.production", None)
        if saved_base is not None:
            sys.modules["config.settings.base"] = saved_base
            setattr(settings_pkg, "base", saved_base)
        if saved_prod is not None:
            sys.modules["config.settings.production"] = saved_prod
            setattr(settings_pkg, "production", saved_prod)


def _set_valid_prod_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DJANGO_SECRET_KEY", "a-very-strong-production-secret-key-with-50-plus-chars")
    monkeypatch.setenv("DATABASE_URL", "postgres://smartcorp:secret@db-host:5432/smartcorp")
    monkeypatch.setenv("DJANGO_ALLOWED_HOSTS", "smartcorp-api.onrender.com")
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "https://smartcorp-web.onrender.com")
    monkeypatch.setenv("CSRF_TRUSTED_ORIGINS", "https://smartcorp-web.onrender.com")
    monkeypatch.delenv("RENDER_EXTERNAL_HOSTNAME", raising=False)
    monkeypatch.delenv("FRONTEND_URL", raising=False)


class TestMigrateSafeCommand:
    def test_postgresql_acquires_and_releases_advisory_lock(self):
        events: list[str] = []
        cursor = MagicMock()
        cursor.execute.side_effect = lambda sql: events.append(sql)
        cursor_cm = MagicMock()
        cursor_cm.__enter__.return_value = cursor
        cursor_cm.__exit__.return_value = False

        mock_conn = MagicMock()
        mock_conn.vendor = "postgresql"
        mock_conn.cursor.return_value = cursor_cm

        def fake_call_command(name, **kwargs):
            events.append(f"call:{name}:{kwargs.get('interactive')}:{kwargs.get('verbosity')}")

        with (
            patch("common.management.commands.migrate_safe.connection", mock_conn),
            patch("common.management.commands.migrate_safe.call_command", side_effect=fake_call_command),
        ):
            call_command("migrate_safe", verbosity=2)

        mock_conn.ensure_connection.assert_called_once()
        assert events == [
            "SELECT pg_advisory_lock(8472910421)",
            "call:migrate:False:2",
            "SELECT pg_advisory_unlock(8472910421)",
        ]

    def test_postgresql_always_releases_lock_on_migrate_failure(self):
        executed_sql: list[str] = []
        cursor = MagicMock()
        cursor.execute.side_effect = lambda sql: executed_sql.append(sql)
        cursor_cm = MagicMock()
        cursor_cm.__enter__.return_value = cursor
        cursor_cm.__exit__.return_value = False

        mock_conn = MagicMock()
        mock_conn.vendor = "postgresql"
        mock_conn.cursor.return_value = cursor_cm

        with (
            patch("common.management.commands.migrate_safe.connection", mock_conn),
            patch(
                "common.management.commands.migrate_safe.call_command",
                side_effect=RuntimeError("migration failed"),
            ),
        ):
            with pytest.raises(RuntimeError, match="migration failed"):
                call_command("migrate_safe", verbosity=0)

        assert executed_sql == [
            "SELECT pg_advisory_lock(8472910421)",
            "SELECT pg_advisory_unlock(8472910421)",
        ]

    def test_retries_on_transient_operational_error_with_backoff(self):
        mock_conn = MagicMock()
        mock_conn.vendor = "sqlite"
        mock_conn.ensure_connection.side_effect = [
            OperationalError("starting up"),
            OperationalError("still starting"),
            None,
        ]

        with (
            patch("common.management.commands.migrate_safe.connection", mock_conn),
            patch("common.management.commands.migrate_safe.time.sleep") as mock_sleep,
            patch("common.management.commands.migrate_safe.call_command") as mock_migrate,
        ):
            call_command("migrate_safe", verbosity=1)

        assert mock_conn.ensure_connection.call_count == 3
        assert mock_conn.close_if_unusable_or_obsolete.call_count == 2
        assert mock_sleep.call_args_list == [call(1), call(2)]
        mock_migrate.assert_called_once_with("migrate", interactive=False, verbosity=1)

    def test_raises_command_error_after_max_retries(self):
        mock_conn = MagicMock()
        mock_conn.ensure_connection.side_effect = OperationalError("connection refused")

        with (
            patch("common.management.commands.migrate_safe.connection", mock_conn),
            patch("common.management.commands.migrate_safe.time.sleep") as mock_sleep,
            patch("common.management.commands.migrate_safe.call_command") as mock_migrate,
        ):
            with pytest.raises(CommandError, match="Database unreachable after 5 attempts"):
                call_command("migrate_safe", verbosity=0)

        assert mock_conn.ensure_connection.call_count == 5
        assert mock_sleep.call_args_list == [call(1), call(2), call(4), call(8)]
        mock_migrate.assert_not_called()

    @pytest.mark.django_db
    def test_non_postgresql_runs_migrate_without_advisory_lock_sql(self):
        with patch("common.management.commands.migrate_safe.call_command") as mock_migrate:
            call_command("migrate_safe", verbosity=0)

        mock_migrate.assert_called_once_with("migrate", interactive=False, verbosity=0)


class TestProductionSettingsHardening:
    def test_render_external_hostname_appended_without_duplicates(self, monkeypatch):
        _set_valid_prod_env(monkeypatch)
        monkeypatch.setenv("RENDER_EXTERNAL_HOSTNAME", "smartcorp-api-x9k2.onrender.com")
        ns = _load_production_settings()

        assert ns["DEBUG"] is False
        assert ns["DEMO_ENDPOINTS_ENABLED"] is False
        assert ns["ALLOWED_HOSTS"] == [
            "smartcorp-api.onrender.com",
            "smartcorp-api-x9k2.onrender.com",
        ]

        # When already present, it should not be duplicated.
        monkeypatch.setenv("DJANGO_ALLOWED_HOSTS", "smartcorp-api-x9k2.onrender.com")
        ns_dedup = _load_production_settings()
        assert ns_dedup["ALLOWED_HOSTS"] == ["smartcorp-api-x9k2.onrender.com"]

    def test_render_external_hostname_satisfies_allowed_hosts(self, monkeypatch):
        _set_valid_prod_env(monkeypatch)
        monkeypatch.setenv("DJANGO_ALLOWED_HOSTS", "")
        monkeypatch.setenv("RENDER_EXTERNAL_HOSTNAME", "smartcorp-api-abcd.onrender.com")
        ns = _load_production_settings()
        assert ns["ALLOWED_HOSTS"] == ["smartcorp-api-abcd.onrender.com"]

    def test_frontend_url_added_to_cors_and_csrf_only_when_non_local(self, monkeypatch):
        _set_valid_prod_env(monkeypatch)
        monkeypatch.setenv("FRONTEND_URL", "https://smartcorp-web-a1b2.onrender.com/")
        ns = _load_production_settings()

        assert "https://smartcorp-web.onrender.com" in ns["CORS_ALLOWED_ORIGINS"]
        assert "https://smartcorp-web-a1b2.onrender.com" in ns["CORS_ALLOWED_ORIGINS"]
        assert "https://smartcorp-web.onrender.com" in ns["CSRF_TRUSTED_ORIGINS"]
        assert "https://smartcorp-web-a1b2.onrender.com" in ns["CSRF_TRUSTED_ORIGINS"]

        # Localhost / 127.0.0.1 URLs must never be appended in production.
        for local_url in ("http://localhost:5173", "http://127.0.0.1:5173"):
            monkeypatch.setenv("FRONTEND_URL", local_url)
            ns_local = _load_production_settings()
            assert local_url not in ns_local["CORS_ALLOWED_ORIGINS"]
            assert local_url not in ns_local["CSRF_TRUSTED_ORIGINS"]

    def test_raises_improperly_configured_without_secret_key(self, monkeypatch):
        _set_valid_prod_env(monkeypatch)
        monkeypatch.delenv("DJANGO_SECRET_KEY", raising=False)
        with pytest.raises(ImproperlyConfigured, match="DJANGO_SECRET_KEY"):
            _load_production_settings()

    def test_raises_improperly_configured_with_sqlite_database_url(self, monkeypatch):
        _set_valid_prod_env(monkeypatch)
        monkeypatch.setenv("DATABASE_URL", "sqlite:///db.sqlite3")
        with pytest.raises(ImproperlyConfigured, match="PostgreSQL"):
            _load_production_settings()

    def test_raises_improperly_configured_without_allowed_hosts(self, monkeypatch):
        _set_valid_prod_env(monkeypatch)
        monkeypatch.setenv("DJANGO_ALLOWED_HOSTS", "")
        with pytest.raises(ImproperlyConfigured, match="DJANGO_ALLOWED_HOSTS"):
            _load_production_settings()

    def test_health_endpoint_returns_200_without_db_or_redis(self, api_client):
        with patch.object(connections["default"], "ensure_connection", side_effect=AssertionError("DB touched")):
            response = api_client.get("/health/")

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "ok"
        assert body["service"] == "smartcorp-api"
