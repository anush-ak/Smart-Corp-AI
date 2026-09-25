"""Structured-logging helpers.

A request ID is stored in a :mod:`contextvars` variable by
:class:`common.middleware.RequestIDMiddleware` so every log line emitted while
handling a request can be correlated. Never log secrets here.
"""

from __future__ import annotations

import contextvars
import logging

request_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar(
    "smartcorp_request_id", default="-"
)


def get_request_id() -> str:
    """Return the current request ID (``-`` outside a request)."""
    return request_id_ctx.get()


class RequestIdFilter(logging.Filter):
    """Injects ``request_id`` into every log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_request_id()
        return True


def get_logger(name: str) -> logging.Logger:
    """Return a child of the ``smartcorp`` logger."""
    return logging.getLogger(f"smartcorp.{name}")
