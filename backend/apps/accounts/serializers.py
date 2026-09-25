"""Serializers: validation + canonical (snake_case) representation.

Session-shaped (camelCase) serializers for the current web client live in
``serializers_session.py``; the canonical shapes here are the long-term API
contract.
"""

from __future__ import annotations

from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from services.security import get_user_permissions

from .models import RoleChoices, User


class OrganizationMiniSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(read_only=True)
    slug = serializers.CharField(read_only=True)


class DepartmentMiniSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(read_only=True)


class UserSerializer(serializers.ModelSerializer):
    """Canonical read representation. Never includes password material."""

    full_name = serializers.CharField(read_only=True)
    organization = OrganizationMiniSerializer(read_only=True)
    department = DepartmentMiniSerializer(read_only=True)
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "username",
            "first_name",
            "last_name",
            "full_name",
            "profile_photo",
            "organization",
            "department",
            "role",
            "job_title",
            "knowledge_scope",
            "agent_scope",
            "is_active",
            "is_email_verified",
            "permissions",
            "last_login",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_permissions(self, obj: User) -> list[str]:
        return sorted(get_user_permissions(obj))


class _DepartmentField(serializers.PrimaryKeyRelatedField):
    def __init__(self, **kwargs):
        from apps.organizations.models import Department

        super().__init__(queryset=Department.objects.all(), **kwargs)


class UserCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    first_name = serializers.CharField(required=False, allow_blank=True, default="")
    last_name = serializers.CharField(required=False, allow_blank=True, default="")
    username = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    role = serializers.CharField(required=False, default=RoleChoices.EMPLOYEE)
    department = _DepartmentField(required=False, allow_null=True)
    job_title = serializers.CharField(required=False, allow_blank=True, default="")
    knowledge_scope = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )
    agent_scope = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )

    def validate_email(self, value: str) -> str:
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_role(self, value: str) -> str:
        normalized = str(value or "").upper()
        if normalized not in RoleChoices.values:
            raise serializers.ValidationError(f"Unknown role '{value}'.")
        return normalized


class UserUpdateSerializer(serializers.Serializer):
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    username = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    role = serializers.CharField(required=False)
    department = _DepartmentField(required=False, allow_null=True)
    job_title = serializers.CharField(required=False, allow_blank=True)
    is_active = serializers.BooleanField(required=False)
    knowledge_scope = serializers.ListField(
        child=serializers.CharField(), required=False
    )
    agent_scope = serializers.ListField(child=serializers.CharField(), required=False)

    def validate_role(self, value: str) -> str:
        normalized = str(value or "").upper()
        if normalized not in RoleChoices.values:
            raise serializers.ValidationError(f"Unknown role '{value}'.")
        return normalized


class UserScopeSerializer(serializers.Serializer):
    """PATCH /users/<id>/scope/ — accepts snake_case and camelCase keys."""

    role = serializers.CharField(required=False)
    knowledge_scope = serializers.ListField(
        child=serializers.CharField(), required=False
    )
    agent_scope = serializers.ListField(child=serializers.CharField(), required=False)

    def to_internal_value(self, data):
        if isinstance(data, dict):
            data = dict(data)
            if "knowledgeScope" in data and "knowledge_scope" not in data:
                data["knowledge_scope"] = data.pop("knowledgeScope")
            if "agentScope" in data and "agent_scope" not in data:
                data["agent_scope"] = data.pop("agentScope")
            data.pop("userId", None)
            data.pop("user_id", None)
        return super().to_internal_value(data)

    def validate_role(self, value: str) -> str:
        normalized = str(value or "").upper()
        if normalized not in RoleChoices.values:
            raise serializers.ValidationError(f"Unknown role '{value}'.")
        return normalized


class ProfileUpdateSerializer(serializers.Serializer):
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    username = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    job_title = serializers.CharField(required=False, allow_blank=True)
    profile_photo = serializers.ImageField(required=False, allow_null=True)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(trim_whitespace=True)
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_new_password(self, value: str) -> str:
        try:
            password_validation.validate_password(value, self.context.get("user"))
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(trim_whitespace=True)


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True)


class EmailVerifyConfirmSerializer(serializers.Serializer):
    token = serializers.CharField()


class DemoSwitchSerializer(serializers.Serializer):
    user_id = serializers.CharField()

    def to_internal_value(self, data):
        if isinstance(data, dict):
            data = dict(data)
            if "userId" in data and "user_id" not in data:
                data["user_id"] = data.pop("userId")
        return super().to_internal_value(data)


class RoleDefinitionSerializer(serializers.Serializer):
    role = serializers.CharField()
    label = serializers.CharField()
    summary = serializers.CharField()
    permissions = serializers.ListField(child=serializers.CharField())
    knowledgeScopeDescription = serializers.CharField(source="knowledge_scope_description")
