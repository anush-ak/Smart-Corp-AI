"""Isolated integration-boundary tests; never call Google or Redis in CI."""

from unittest.mock import Mock, patch

from django.test import SimpleTestCase, override_settings

from services.ai.google_client import AINotConfiguredError, get_genai_client, google_genai_configured


class TestGoogleBoundary(SimpleTestCase):
    @override_settings(GOOGLE_API_KEY="")
    def test_missing_key_degrades_without_constructing_client(self):
        assert google_genai_configured() is False
        assert get_genai_client() is None

    @override_settings(GOOGLE_API_KEY="test-only-not-a-secret")
    def test_configured_key_constructs_sdk_client_lazily(self):
        fake_client = Mock(name="genai-client")
        fake_genai = Mock()
        fake_genai.Client.return_value = fake_client
        with patch.dict("sys.modules", {"google": Mock(genai=fake_genai)}):
            assert get_genai_client() is fake_client
        fake_genai.Client.assert_called_once_with(api_key="test-only-not-a-secret")

    @override_settings(GOOGLE_API_KEY="test-only-not-a-secret")
    def test_missing_sdk_is_explicit_error(self):
        with patch.dict("sys.modules", {"google": None}):
            try:
                get_genai_client()
            except AINotConfiguredError as exc:
                assert "google-genai" in str(exc)
            else:  # pragma: no cover
                raise AssertionError("missing SDK must not silently degrade when a key is configured")
