"""Web-client session shapes (camelCase) for auth endpoints.

These mirror the contract the current React client is written against:
``{ user, organization, roles }``. Canonical snake_case serializers remain
the long-term API contract (see ``serializers.py``).
"""

from __future__ import annotations

from rest_framework import serializers

from .models import User

AVATAR_COLORS = (
    "indigo",
    "emerald",
    "sky",
    "amber",
    "violet",
    "rose",
    "teal",
    "orange",
)

#: Backend department name → web-client Department enum.
DEPARTMENT_MAP = {
    "HR": "HR",
    "HUMAN RESOURCES": "HR",
    "FINANCE": "Finance",
    "SUPPORT": "Support",
    "ENGINEERING": "Engineering",
    "OPERATIONS": "Operations",
}


class SessionUserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(read_only=True)
    role = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()
    jobTitle = serializers.CharField(source="job_title", read_only=True)
    status = serializers.SerializerMethodField()
    lastActiveAt = serializers.SerializerMethodField()
    knowledgeScope = serializers.ListField(source="knowledge_scope", read_only=True)
    agentScope = serializers.ListField(source="agent_scope", read_only=True)
    avatarColor = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "name",
            "email",
            "role",
            "department",
            "jobTitle",
            "status",
            "lastActiveAt",
            "knowledgeScope",
            "agentScope",
            "avatarColor",
        ]

    def get_role(self, obj: User) -> str:
        return str(obj.role or "EMPLOYEE").lower()

    def get_department(self, obj: User) -> str:
        department = getattr(obj, "department", None)
        name = str(getattr(department, "name", "") or "").upper()
        return DEPARTMENT_MAP.get(name, "General")

    def get_status(self, obj: User) -> str:
        if not obj.is_active:
            return "suspended"
        if obj.last_login is None:
            return "invited"
        return "active"

    def get_lastActiveAt(self, obj: User) -> str | None:
        moment = obj.last_login or obj.created_at
        return moment.isoformat() if moment else None

    def get_avatarColor(self, obj: User) -> str:
        return AVATAR_COLORS[hash(str(obj.pk)) % len(AVATAR_COLORS)]


class SessionOrganizationSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(read_only=True)
    slug = serializers.CharField(read_only=True)
    domain = serializers.CharField(read_only=True)
    plan = serializers.SerializerMethodField()
    dataRegion = serializers.CharField(source="data_region", read_only=True)
    mfaRequired = serializers.BooleanField(source="mfa_required", read_only=True)

    def get_plan(self, obj) -> str:
        return str(getattr(obj, "plan", "") or "").title()
