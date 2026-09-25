"""Canonical RBAC permission catalog for SmartCorp AI.

Backend permissions use ``domain.action`` style (``users.view``). The web
client historically uses ``domain:action`` style (``users:view``), so this
module also owns the bridge mapping — the API is the single source of truth
and the frontend never guesses permissions.

Roles: OWNER / ADMIN / HR / MANAGER / FINANCE / SUPPORT / EMPLOYEE.
``OWNER`` holds every permission; every other role is an explicit subset.
"""

from __future__ import annotations

from typing import Iterable


class Perm:
    """Granular permission identifiers (never hard-code these in views)."""

    USERS_VIEW = "users.view"
    USERS_CREATE = "users.create"
    USERS_UPDATE = "users.update"
    USERS_DELETE = "users.delete"

    ORGANIZATIONS_VIEW = "organizations.view"
    ORGANIZATIONS_MANAGE = "organizations.manage"
    DEPARTMENTS_VIEW = "departments.view"
    DEPARTMENTS_MANAGE = "departments.manage"

    DOCUMENTS_VIEW = "documents.view"
    DOCUMENTS_UPLOAD = "documents.upload"
    DOCUMENTS_DELETE = "documents.delete"
    DOCUMENTS_APPROVE = "documents.approve"

    KNOWLEDGE_SEARCH = "knowledge.search"
    KNOWLEDGE_MANAGE = "knowledge.manage"

    ANALYTICS_VIEW = "analytics.view"
    ANALYTICS_RUN = "analytics.run"

    WORKFLOWS_VIEW = "workflows.view"
    WORKFLOWS_CREATE = "workflows.create"
    WORKFLOWS_APPROVE = "workflows.approve"

    MEETINGS_VIEW = "meetings.view"
    MEETINGS_MANAGE = "meetings.manage"

    AI_USE = "ai.use"
    AI_MANAGE = "ai.manage"

    AUDIT_VIEW = "audit.view"

    EVALUATION_VIEW = "evaluation.view"
    EVALUATION_RUN = "evaluation.run"


ALL_PERMISSIONS: tuple[str, ...] = (
    Perm.USERS_VIEW,
    Perm.USERS_CREATE,
    Perm.USERS_UPDATE,
    Perm.USERS_DELETE,
    Perm.ORGANIZATIONS_VIEW,
    Perm.ORGANIZATIONS_MANAGE,
    Perm.DEPARTMENTS_VIEW,
    Perm.DEPARTMENTS_MANAGE,
    Perm.DOCUMENTS_VIEW,
    Perm.DOCUMENTS_UPLOAD,
    Perm.DOCUMENTS_DELETE,
    Perm.DOCUMENTS_APPROVE,
    Perm.KNOWLEDGE_SEARCH,
    Perm.KNOWLEDGE_MANAGE,
    Perm.ANALYTICS_VIEW,
    Perm.ANALYTICS_RUN,
    Perm.WORKFLOWS_VIEW,
    Perm.WORKFLOWS_CREATE,
    Perm.WORKFLOWS_APPROVE,
    Perm.MEETINGS_VIEW,
    Perm.MEETINGS_MANAGE,
    Perm.AI_USE,
    Perm.AI_MANAGE,
    Perm.AUDIT_VIEW,
    Perm.EVALUATION_VIEW,
    Perm.EVALUATION_RUN,
)

# Lower rank = more privilege. Used for "may manage roles at or below me".
ROLE_RANK: dict[str, int] = {
    "OWNER": 0,
    "ADMIN": 1,
    "HR": 2,
    "MANAGER": 3,
    "FINANCE": 4,
    "SUPPORT": 5,
    "EMPLOYEE": 6,
}

_COMMON_VIEW = frozenset(
    {
        Perm.ORGANIZATIONS_VIEW,
        Perm.DEPARTMENTS_VIEW,
        Perm.MEETINGS_VIEW,
        Perm.KNOWLEDGE_SEARCH,
        Perm.DOCUMENTS_VIEW,
        Perm.WORKFLOWS_VIEW,
        Perm.AI_USE,
    }
)

ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    # OWNER is special-cased to ALL_PERMISSIONS in get_role_permissions().
    "OWNER": frozenset(ALL_PERMISSIONS),
    "ADMIN": frozenset(set(ALL_PERMISSIONS) - {Perm.USERS_DELETE}),
    "HR": frozenset(
        _COMMON_VIEW
        | {
            Perm.USERS_VIEW,
            Perm.DOCUMENTS_UPLOAD,
            Perm.KNOWLEDGE_MANAGE,
            Perm.ANALYTICS_VIEW,
            Perm.WORKFLOWS_CREATE,
            Perm.WORKFLOWS_APPROVE,
            Perm.MEETINGS_MANAGE,
            Perm.EVALUATION_VIEW,
        }
    ),
    "MANAGER": frozenset(
        _COMMON_VIEW
        | {
            Perm.USERS_VIEW,
            Perm.ANALYTICS_VIEW,
            Perm.WORKFLOWS_CREATE,
            Perm.WORKFLOWS_APPROVE,
            Perm.MEETINGS_MANAGE,
        }
    ),
    "FINANCE": frozenset(
        _COMMON_VIEW
        | {
            Perm.DOCUMENTS_UPLOAD,
            Perm.KNOWLEDGE_MANAGE,
            Perm.ANALYTICS_VIEW,
            Perm.ANALYTICS_RUN,
            Perm.WORKFLOWS_CREATE,
            Perm.WORKFLOWS_APPROVE,
        }
    ),
    "SUPPORT": frozenset(
        _COMMON_VIEW | {Perm.WORKFLOWS_CREATE, Perm.MEETINGS_MANAGE}
    ),
    "EMPLOYEE": frozenset(_COMMON_VIEW | {Perm.WORKFLOWS_CREATE}),
}

#: Backend (dot) permission → web-client (colon) permissions.
FRONTEND_PERMISSION_MAP: dict[str, tuple[str, ...]] = {
    Perm.USERS_VIEW: ("users:view",),
    Perm.USERS_CREATE: ("users:manage",),
    Perm.USERS_UPDATE: ("users:manage",),
    Perm.USERS_DELETE: ("users:manage",),
    Perm.ORGANIZATIONS_VIEW: ("overview:view",),
    Perm.ORGANIZATIONS_MANAGE: ("settings:manage", "security:view"),
    Perm.DEPARTMENTS_VIEW: ("overview:view",),
    Perm.DEPARTMENTS_MANAGE: ("settings:manage",),
    Perm.DOCUMENTS_VIEW: ("knowledge:view",),
    Perm.DOCUMENTS_UPLOAD: ("knowledge:manage",),
    Perm.DOCUMENTS_DELETE: ("knowledge:manage",),
    Perm.DOCUMENTS_APPROVE: ("knowledge:manage",),
    Perm.KNOWLEDGE_SEARCH: ("knowledge:view",),
    Perm.KNOWLEDGE_MANAGE: ("knowledge:manage",),
    Perm.ANALYTICS_VIEW: ("analytics:view",),
    Perm.ANALYTICS_RUN: ("analytics:view",),
    Perm.WORKFLOWS_VIEW: ("decisions:view", "approvals:view"),
    Perm.WORKFLOWS_CREATE: ("approvals:view",),
    Perm.WORKFLOWS_APPROVE: ("decisions:approve", "approvals:act"),
    Perm.MEETINGS_VIEW: ("meetings:view",),
    Perm.MEETINGS_MANAGE: ("meetings:view",),
    Perm.AI_USE: ("assistant:use", "agents:view"),
    Perm.AI_MANAGE: ("agents:manage",),
    Perm.AUDIT_VIEW: ("audit:view", "security:view"),
    Perm.EVALUATION_VIEW: ("evaluation:view",),
    Perm.EVALUATION_RUN: ("evaluation:run",),
}

ROLE_METADATA: dict[str, dict[str, str]] = {
    "OWNER": {
        "label": "Owner",
        "summary": "Complete organisation access, including users, billing-adjacent settings and audit.",
        "knowledge_scope_description": "All knowledge bases, including restricted documents.",
    },
    "ADMIN": {
        "label": "Administrator",
        "summary": "Full platform access, including governance, evaluation and security configuration.",
        "knowledge_scope_description": "All knowledge bases, including restricted documents.",
    },
    "HR": {
        "label": "HR",
        "summary": "People knowledge, HR agent and employee-facing approvals.",
        "knowledge_scope_description": "HR and product knowledge bases. Finance documents are filtered out at retrieval.",
    },
    "MANAGER": {
        "label": "Manager",
        "summary": "Team analytics, team tasks and approvals for direct reports.",
        "knowledge_scope_description": "Department and general knowledge. Restricted documents are not retrievable.",
    },
    "FINANCE": {
        "label": "Finance",
        "summary": "Finance knowledge, finance agent and spend-related approvals.",
        "knowledge_scope_description": "Finance and product knowledge bases. Restricted board documents require elevation.",
    },
    "SUPPORT": {
        "label": "Support",
        "summary": "Support knowledge, support agent and customer-impacting decisions.",
        "knowledge_scope_description": "Support and product knowledge bases.",
    },
    "EMPLOYEE": {
        "label": "Employee",
        "summary": "Ask questions against permitted knowledge and track your own requests.",
        "knowledge_scope_description": "General and department knowledge only. Restricted documents are not retrievable.",
    },
}


def _normalize_role(role: str | None) -> str:
    return str(role or "").upper()


def get_role_permissions(role: str | None) -> set[str]:
    """Return the canonical permission set for a role value."""
    normalized = _normalize_role(role)
    if normalized == "OWNER":
        return set(ALL_PERMISSIONS)
    return set(ROLE_PERMISSIONS.get(normalized, frozenset()))


def get_user_permissions(user) -> set[str]:
    """Return the effective permission set for a user instance."""
    if user is None or not getattr(user, "is_authenticated", False):
        return set()
    if not getattr(user, "is_active", False):
        return set()
    if getattr(user, "is_superuser", False):
        return set(ALL_PERMISSIONS)
    return get_role_permissions(getattr(user, "role", None))


def has_permission(user, permission: str) -> bool:
    """Check a single canonical permission (``users.view`` style)."""
    return permission in get_user_permissions(user)


def has_any_permission(user, permissions: Iterable[str]) -> bool:
    """Check whether the user holds at least one of the permissions."""
    granted = get_user_permissions(user)
    return any(item in granted for item in permissions)


def get_frontend_permissions(role_or_permissions) -> list[str]:
    """Bridge canonical permissions to web-client (``users:view``) style."""
    if isinstance(role_or_permissions, str):
        canonical = get_role_permissions(role_or_permissions)
    else:
        canonical = set(role_or_permissions)
    bridged: set[str] = set()
    for permission in canonical:
        bridged.update(FRONTEND_PERMISSION_MAP.get(permission, ()))
    return sorted(bridged)
