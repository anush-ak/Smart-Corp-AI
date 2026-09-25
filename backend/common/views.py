"""Health and readiness probes (unauthenticated, no secrets)."""

from __future__ import annotations

from django.conf import settings
from django.db import connections
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

API_VERSION = "1.0.0-phase1"


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def health(request):
    """Liveness probe — the process is up (no dependency checks)."""
    return Response(
        {
            "status": "ok",
            "service": "smartcorp-api",
            "version": API_VERSION,
            "request_id": getattr(request, "request_id", "-"),
        }
    )


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def ready(request):
    """Readiness probe — verifies Django, database and (if configured) Redis."""
    checks: dict[str, str] = {}
    degraded = False

    try:
        connections["default"].ensure_connection()
        with connections["default"].cursor() as cursor:
            cursor.execute("SELECT 1")
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "unavailable"
        degraded = True

    redis_url = getattr(settings, "REDIS_URL", "")
    if redis_url:
        try:
            import redis

            redis.Redis.from_url(redis_url, socket_connect_timeout=2).ping()
            checks["redis"] = "ok"
        except Exception:
            checks["redis"] = "unavailable"
            degraded = True
    else:
        checks["redis"] = "not_configured"

    return Response(
        {
            "status": "degraded" if degraded else "ready",
            "service": "smartcorp-api",
            "version": API_VERSION,
            "checks": checks,
        },
        status=503 if degraded else 200,
    )
