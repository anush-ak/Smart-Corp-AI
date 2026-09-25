"""Google Gemini client factory.

SmartCorp AI uses Google's Generative AI (Gemini) as its only model provider.
Phase 1 only wires configuration; the centralised ``AIService`` (retries,
timeouts, token tracking, streaming) is built in Phase 5 on top of this.

Design rule: a missing/invalid key must NEVER break non-AI parts of the app.
Callers treat a ``None`` client as "AI unavailable" and degrade gracefully.
"""

from __future__ import annotations

from django.conf import settings

from common.logging_utils import get_logger

logger = get_logger("ai.google")


class AINotConfiguredError(RuntimeError):
    """Raised when AI is invoked without a usable Google API key."""


def google_genai_configured() -> bool:
    """True when a Google API key is present in settings (env var)."""
    return bool(getattr(settings, "GOOGLE_API_KEY", ""))


def get_genai_client():
    """Lazily construct a ``google.genai`` client, or return None.

    Returns None (with a warning log) when no key is configured so normal
    application flows keep working. Raises :class:`AINotConfiguredError`
    only if the SDK itself is missing while a key IS configured.
    """
    if not google_genai_configured():
        logger.warning("GOOGLE_API_KEY is not configured; AI features are disabled.")
        return None
    try:
        from google import genai
    except ImportError as exc:  # pragma: no cover - dependency present in requirements
        raise AINotConfiguredError(
            "GOOGLE_API_KEY is set but the 'google-genai' package is not installed."
        ) from exc
    return genai.Client(api_key=settings.GOOGLE_API_KEY)
