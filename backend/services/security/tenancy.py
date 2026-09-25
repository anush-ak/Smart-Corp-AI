"""Tenant isolation helpers.

Every organisation-owned row is scoped at the service/query level. Cross-
organisation access returns 404 (not 403) so callers cannot probe for the
existence of other tenants' data.
"""

from __future__ import annotations

from rest_framework.exceptions import NotFound


def scope_to_organization(user, queryset, field: str = "organization"):
    """Filter a queryset down to the caller's organisation."""
    if getattr(user, "is_superuser", False) and not getattr(user, "organization_id", None):
        # Break-glass platform superuser with no home organisation.
        return queryset
    return queryset.filter(**{f"{field}_id": getattr(user, "organization_id", None)})


def ensure_same_organization(user, obj, field: str = "organization"):
    """Return ``obj`` if it belongs to the caller's organisation, else 404."""
    if getattr(user, "is_superuser", False) and not getattr(user, "organization_id", None):
        return obj
    obj_org_id = getattr(obj, f"{field}_id", None)
    if not obj_org_id or obj_org_id != getattr(user, "organization_id", None):
        raise NotFound("Not found.")
    return obj
