"""Reusable DRF permission classes.

All authorization is enforced here on the backend — the frontend's own checks
only decide what is *shown*. Roles are hierarchical: ``OWNER`` (and Django
superusers) pass every role gate.
"""

from __future__ import annotations

from rest_framework.permissions import BasePermission

from services.security import permissions as perm_service


def _role(user) -> str:
    return str(getattr(user, "role", "") or "").upper()


class IsOrganizationMember(BasePermission):
    """Caller must belong to an organisation (or be a platform superuser)."""

    message = "Organization membership required."

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return bool(getattr(user, "is_superuser", False) or getattr(user, "organization_id", None))


class _RoleGate(BasePermission):
    """Base gate: passes for the listed roles plus OWNER / superuser."""

    allowed_roles: frozenset[str] = frozenset()
    message = "Your role does not permit this action."

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if getattr(user, "is_superuser", False):
            return True
        role = _role(user)
        return role == "OWNER" or role in self.allowed_roles


class IsOwner(_RoleGate):
    allowed_roles = frozenset({"OWNER"})


class IsAdmin(_RoleGate):
    allowed_roles = frozenset({"ADMIN"})


class IsHR(_RoleGate):
    allowed_roles = frozenset({"HR"})


class IsManager(_RoleGate):
    allowed_roles = frozenset({"MANAGER"})


class IsEmployee(BasePermission):
    """Any authenticated organisation member (every role is an employee)."""

    message = "Authentication required."

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(user and user.is_authenticated)


class IsOwnerOrAdmin(_RoleGate):
    allowed_roles = frozenset({"ADMIN"})


class HasPermission(BasePermission):
    """Gate on a granular ``services.security`` permission.

    Declare ``required_permission = "users.view"`` either on the permission
    subclass or on the view.
    """

    message = "You cannot access this resource."
    required_permission: str | None = None

    def has_permission(self, request, view) -> bool:
        required = self.required_permission or getattr(view, "required_permission", None)
        if required is None:  # pragma: no cover - programmer error, fail closed
            return False
        return perm_service.has_permission(request.user, required)


class CanViewUser(BasePermission):
    """Users can always read their own record; otherwise needs ``users.view``."""

    message = "You cannot access this resource."

    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj) -> bool:
        if str(getattr(obj, "pk", "")) == str(getattr(request.user, "pk", "")):
            return True
        return perm_service.has_permission(request.user, perm_service.Perm.USERS_VIEW)


class CanManageUsers(HasPermission):
    """Alias kept for readability — requires ``users.update`` by default."""

    required_permission = perm_service.Perm.USERS_UPDATE  # type: ignore[assignment]


class CanRunAnalytics(HasPermission):
    required_permission = perm_service.Perm.ANALYTICS_RUN  # type: ignore[assignment]


class CanApproveWorkflow(HasPermission):
    required_permission = perm_service.Perm.WORKFLOWS_APPROVE  # type: ignore[assignment]


class CanAccessDocument(BasePermission):
    """Phase 1 document gate: same organisation + ``documents.view``.

    Fine-grained per-document access rules land with the knowledge base
    (Phase 3); the RAG layer will enforce them at retrieval time.
    """

    message = "You cannot access this document."

    def has_permission(self, request, view) -> bool:
        return perm_service.has_permission(request.user, perm_service.Perm.DOCUMENTS_VIEW)

    def has_object_permission(self, request, view, obj) -> bool:
        user = request.user
        if getattr(user, "is_superuser", False) and not getattr(user, "organization_id", None):
            return True
        obj_org = getattr(obj, "organization_id", None)
        return bool(obj_org) and obj_org == getattr(user, "organization_id", None)
