"""Organisation + department endpoints (tenant-scoped, RBAC-guarded)."""

from __future__ import annotations

from django.db import IntegrityError
from django.db.models import Count
from rest_framework import status, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.serializers_session import SessionOrganizationSerializer
from common.permissions import HasPermission
from services.security import Perm, ensure_same_organization, scope_to_organization

from .models import Department, Organization
from .serializers import (
    DepartmentSerializer,
    DepartmentWriteSerializer,
    OrganizationSerializer,
    OrganizationUpdateSerializer,
)


class _Perm(HasPermission):
    def __init__(self, required: str):
        self.required_permission = required


class CurrentOrganizationView(APIView):
    """The caller's own organisation (web-client session shape)."""

    def get(self, request):
        organization = getattr(request.user, "organization", None)
        if organization is None:
            return Response(
                {"detail": "No organisation is associated with this account."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(SessionOrganizationSerializer(organization).data)


class OrganizationDetailView(APIView):
    """Read (any member) / update (owner+admin) a single organisation."""

    def get_object(self, request, pk) -> Organization:
        organization = get_object_or_404(
            Organization.objects.annotate(
                member_count=Count("members", distinct=True),
                department_count=Count("departments", distinct=True),
            ),
            pk=pk,
        )
        return self._scoped(request, organization)

    @staticmethod
    def _scoped(request, organization: Organization) -> Organization:
        user = request.user
        if getattr(user, "is_superuser", False) and not getattr(user, "organization_id", None):
            return organization
        if str(organization.pk) != str(getattr(user, "organization_id", "")):
            from rest_framework.exceptions import NotFound

            raise NotFound("Not found.")
        return organization

    def get(self, request, pk):
        from services.security import has_permission

        if not has_permission(request.user, Perm.ORGANIZATIONS_VIEW):
            raise PermissionDenied("You cannot access this resource.")
        return Response(OrganizationSerializer(self.get_object(request, pk)).data)

    def patch(self, request, pk):
        from services.security import has_permission

        if not has_permission(request.user, Perm.ORGANIZATIONS_MANAGE):
            raise PermissionDenied("You cannot access this resource.")
        organization = self.get_object(request, pk)
        serializer = OrganizationUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        # Plan changes are Owner-only (subscription sensitivity).
        if "plan" in data and str(getattr(request.user, "role", "")).upper() != "OWNER":
            if not getattr(request.user, "is_superuser", False):
                raise PermissionDenied("Only the Owner can change the plan.")
        for field, value in data.items():
            setattr(organization, field, value)
        organization.save()
        return Response(OrganizationSerializer(organization).data)


class DepartmentViewSet(viewsets.ModelViewSet):
    serializer_class = DepartmentSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    filterset_fields = ["name"]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]

    def get_queryset(self):
        base = (
            Department.objects.select_related("organization", "manager")
            .annotate(member_count=Count("members", distinct=True))
            .order_by(*self.ordering)
        )
        return scope_to_organization(self.request.user, base)

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            return [_Perm(Perm.DEPARTMENTS_VIEW)]
        if self.action in {"create", "update", "partial_update", "destroy"}:
            return [_Perm(Perm.DEPARTMENTS_MANAGE)]
        return [_Perm(Perm.DEPARTMENTS_VIEW)]

    def _resolve_manager(self, manager_id):
        if manager_id in (None, ""):
            return None
        manager = get_object_or_404(User, pk=manager_id)
        ensure_same_organization(self.request.user, manager)
        return manager

    def create(self, request, *args, **kwargs):
        serializer = DepartmentWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if "name" not in data:
            raise ValidationError({"name": ["This field is required."]})
        try:
            department = Department.objects.create(
                organization=request.user.organization,
                name=data["name"],
                description=data.get("description", ""),
                manager=self._resolve_manager(data.get("manager_id")),
            )
        except IntegrityError:
            raise ValidationError(
                {"name": ["A department with this name already exists."]}
            )
        return Response(
            DepartmentSerializer(department).data, status=status.HTTP_201_CREATED
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        department = self.get_object()
        serializer = DepartmentWriteSerializer(data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if "name" in data:
            department.name = data["name"]
        if "description" in data:
            department.description = data["description"]
        if "manager_id" in data:
            department.manager = self._resolve_manager(data["manager_id"])
        try:
            department.save()
        except IntegrityError:
            raise ValidationError(
                {"name": ["A department with this name already exists."]}
            )
        return Response(DepartmentSerializer(department).data)
