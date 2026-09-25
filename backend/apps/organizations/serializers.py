"""Organisation + department serializers (canonical shapes)."""

from __future__ import annotations

from rest_framework import serializers

from .models import Department, Organization, PlanChoices


class OrganizationSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()
    department_count = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
            "slug",
            "logo",
            "industry",
            "timezone",
            "plan",
            "domain",
            "data_region",
            "mfa_required",
            "settings",
            "member_count",
            "department_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "slug", "created_at", "updated_at"]

    def get_member_count(self, obj: Organization) -> int:
        annotated = getattr(obj, "member_count", None)
        if annotated is not None:
            return annotated
        return obj.members.count()

    def get_department_count(self, obj: Organization) -> int:
        annotated = getattr(obj, "department_count", None)
        if annotated is not None:
            return annotated
        return obj.departments.count()


class OrganizationUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(required=False)
    logo = serializers.ImageField(required=False, allow_null=True)
    industry = serializers.CharField(required=False, allow_blank=True)
    timezone = serializers.CharField(required=False)
    plan = serializers.ChoiceField(choices=PlanChoices.values, required=False)
    domain = serializers.CharField(required=False, allow_blank=True)
    data_region = serializers.CharField(required=False, allow_blank=True)
    mfa_required = serializers.BooleanField(required=False)
    settings = serializers.DictField(required=False)


class ManagerMiniSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    email = serializers.EmailField(read_only=True)
    name = serializers.CharField(read_only=True)


class DepartmentSerializer(serializers.ModelSerializer):
    manager = ManagerMiniSerializer(read_only=True)
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = [
            "id",
            "name",
            "description",
            "manager",
            "member_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_member_count(self, obj: Department) -> int:
        annotated = getattr(obj, "member_count", None)
        if annotated is not None:
            return annotated
        return obj.members.count()


class DepartmentWriteSerializer(serializers.Serializer):
    name = serializers.CharField(required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    manager_id = serializers.UUIDField(required=False, allow_null=True)

    def validate_name(self, value: str) -> str:
        if not value or not value.strip():
            raise serializers.ValidationError("Name must not be blank.")
        return value.strip()
