"""Security services: RBAC permission catalog + tenant isolation."""

from .permissions import (
    ALL_PERMISSIONS,
    FRONTEND_PERMISSION_MAP,
    ROLE_METADATA,
    ROLE_PERMISSIONS,
    ROLE_RANK,
    Perm,
    get_frontend_permissions,
    get_role_permissions,
    get_user_permissions,
    has_any_permission,
    has_permission,
)
from .tenancy import ensure_same_organization, scope_to_organization

__all__ = [
    "ALL_PERMISSIONS",
    "FRONTEND_PERMISSION_MAP",
    "ROLE_METADATA",
    "ROLE_PERMISSIONS",
    "ROLE_RANK",
    "Perm",
    "ensure_same_organization",
    "get_frontend_permissions",
    "get_role_permissions",
    "get_user_permissions",
    "has_any_permission",
    "has_permission",
    "scope_to_organization",
]
