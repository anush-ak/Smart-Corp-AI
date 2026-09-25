"""Centralised DRF exception handling.

Error responses carry the SmartCorp envelope (``success`` / ``message`` /
``errors``) while remaining backward compatible with plain DRF clients: the
top-level ``detail``/``code`` keys and raw field errors are preserved.
"""

from __future__ import annotations

from typing import Any

from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import (
    AuthenticationFailed,
    NotAuthenticated,
    NotFound,
    PermissionDenied,
    Throttled,
    ValidationError,
)
from rest_framework.response import Response
from rest_framework.views import exception_handler

from .logging_utils import get_logger

logger = get_logger("api.errors")


def _code_for(exc: Exception, status_code: int) -> str:
    if isinstance(exc, NotAuthenticated):
        return "not_authenticated"
    if isinstance(exc, AuthenticationFailed):
        return "authentication_failed"
    if isinstance(exc, PermissionDenied):
        return "permission_denied"
    if isinstance(exc, (NotFound, Http404)):
        return "not_found"
    if isinstance(exc, ValidationError):
        return "validation_error"
    if isinstance(exc, Throttled):
        return "throttled"
    return f"http_{status_code}"


def _flatten(data: Any, code: str) -> tuple[str, list[dict[str, str]]]:
    """Normalise DRF error payloads into (message, errors[{code, detail}])."""
    if isinstance(data, dict) and set(data.keys()) <= {"detail", "code"}:
        detail = str(data.get("detail", "Request failed."))
        return detail, [{"code": str(data.get("code", code)), "detail": detail}]
    if isinstance(data, dict) and "detail" in data and len(data) == 1:
        detail = str(data["detail"])
        return detail, [{"code": code, "detail": detail}]
    if isinstance(data, dict):
        errors: list[dict[str, str]] = []
        for field, messages in data.items():
            items = messages if isinstance(messages, list) else [messages]
            for item in items:
                text = getattr(item, "message", None) or str(item)
                # Never echo secrets back: field values are never included,
                # only Django/DRF's own validation messages.
                errors.append(
                    {"code": f"invalid_{field}", "detail": f"{field}: {text}"}
                )
        message = "Validation failed." if errors else "Request failed."
        return message, errors
    if isinstance(data, list):
        parts = [str(item) for item in data]
        message = "; ".join(parts) if parts else "Request failed."
        return message, [{"code": code, "detail": message}]
    detail = str(data) if data else "Request failed."
    return detail, [{"code": code, "detail": detail}]


def smartcorp_exception_handler(exc: Exception, context: dict) -> Response | None:
    """DRF ``EXCEPTION_HANDLER`` — envelope every error consistently."""
    response = exception_handler(exc, context)
    if response is None:
        # Unhandled exception → generic 500, full traceback in server logs only.
        logger.exception("Unhandled exception: %s", exc.__class__.__name__)
        return Response(
            {
                "success": False,
                "data": None,
                "message": "Internal server error.",
                "errors": [
                    {
                        "code": "internal_error",
                        "detail": "Something went wrong. Please try again later.",
                    }
                ],
                "code": "internal_error",
                "detail": "Internal server error.",
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    status_code: int = response.status_code
    code = _code_for(exc, status_code)
    message, errors = _flatten(response.data, code)
    payload: dict[str, Any] = {
        "success": False,
        "data": None,
        "message": message,
        "errors": errors,
        "code": code,
        "detail": message,
    }
    # Preserve raw field errors for DRF-native clients.
    if isinstance(response.data, dict):
        for key, value in response.data.items():
            if key not in payload:
                payload[key] = value
    response.data = payload
    return response
