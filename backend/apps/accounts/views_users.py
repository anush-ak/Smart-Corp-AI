"""User management endpoints — organisation-scoped, RBAC-guarded."""

from __future__ import annotations

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from common.permissions import CanViewUser, HasPermission
from services.security import Perm, has_permission, scope_to_organization

from .models import User
from .serializers import (
    UserCreateSerializer,
    UserScopeSerializer,
    UserSerializer,
    UserUpdateSerializer,
)
from .serializers_session import SessionUserSerializer
from .services import AuthService


class _Perm(HasPermission):
    def __init__(self, required: str):
        self.required_permission = required


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    filterset_fields = ["role", "is_active", "department"]
    search_fields = ["email", "first_name", "last_name", "job_title"]
    ordering_fields = ["email", "created_at", "last_login"]
    ordering = ["email"]

    def get_queryset(self):
        base = (
            User.objects.select_related("organization", "department")
            .all()
            .order_by(*self.ordering)
        )
        return scope_to_organization(self.request.user, base)

    def get_permissions(self):
        if self.action == "retrieve":
            return [CanViewUser()]
        mapping = {
            "list": Perm.USERS_VIEW,
            "create": Perm.USERS_CREATE,
            "update": Perm.USERS_UPDATE,
            "partial_update": Perm.USERS_UPDATE,
            "destroy": Perm.USERS_DELETE,
            "scope": Perm.USERS_UPDATE,
        }
        required = mapping.get(self.action)
        if required is None:  # fail closed
            return [HasPermission()]
        return [_Perm(required)]

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        if self.action in {"update", "partial_update"}:
            return UserUpdateSerializer
        return UserSerializer

    def retrieve(self, request, *args, **kwargs):
        target = self.get_object()
        if str(target.pk) != str(request.user.pk) and not has_permission(
            request.user, Perm.USERS_VIEW
        ):
            raise PermissionDenied("You cannot access this resource.")
        self.check_object_permissions(request, target)
        return Response(UserSerializer(target).data)

    def create(self, request, *args, **kwargs):
        serializer = UserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = AuthService.create_user(request.user, serializer.validated_data)
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        target = self.get_object()
        serializer = UserUpdateSerializer(data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        user = AuthService.update_user(request.user, target, serializer.validated_data)
        return Response(UserSerializer(user).data)

    def destroy(self, request, *args, **kwargs):
        target = self.get_object()
        AuthService.delete_user(request.user, target)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["patch"], url_path="scope")
    def scope(self, request, pk=None):
        """Update a member's role / knowledge / agent scopes (web-client shape)."""
        target = self.get_object()
        serializer = UserScopeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = AuthService.update_scope(request.user, target, **serializer.validated_data)
        return Response(SessionUserSerializer(user).data)
