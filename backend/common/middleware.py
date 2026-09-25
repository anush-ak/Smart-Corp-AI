"""HTTP middleware: request IDs and baseline security headers."""

from __future__ import annotations

import uuid

from django.utils.deprecation import MiddlewareMixin

from .logging_utils import request_id_ctx


class RequestIDMiddleware(MiddlewareMixin):
    """Attach a request ID to the request, logs and response.

    Honours an incoming ``X-Request-ID`` header (useful for tracing across
    services) and always returns the ID to the caller.
    """

    def process_request(self, request) -> None:
        request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:12]
        request.request_id = request_id
        request_id_ctx.set(request_id)

    def process_response(self, request, response):
        response["X-Request-ID"] = getattr(request, "request_id", request_id_ctx.get())
        return response


class SecurityHeadersMiddleware(MiddlewareMixin):
    """Baseline security headers (HSTS/cookies are enforced in production)."""

    def process_response(self, request, response):
        response.setdefault("X-Content-Type-Options", "nosniff")
        response.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        return response
