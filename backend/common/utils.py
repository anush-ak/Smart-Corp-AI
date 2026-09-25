"""Small shared helpers."""

from __future__ import annotations


def get_client_ip(request) -> str:
    """Best-effort client IP (honours X-Forwarded-For behind one proxy)."""
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")
