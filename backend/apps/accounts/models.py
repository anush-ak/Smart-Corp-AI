"""Custom user model — email login, UUID PK, organisation + role.

This model MUST exist before the first migration (``AUTH_USER_MODEL``).
"""

from __future__ import annotations

import uuid

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models


class RoleChoices(models.TextChoices):
    """Canonical backend roles.

    OWNER/ADMIN/HR/MANAGER/EMPLOYEE are the spec roles; FINANCE and SUPPORT
    back the Finance/Support agents and the matching web-client personas.
    """

    OWNER = "OWNER", "Owner"
    ADMIN = "ADMIN", "Administrator"
    HR = "HR", "HR"
    MANAGER = "MANAGER", "Manager"
    FINANCE = "FINANCE", "Finance"
    SUPPORT = "SUPPORT", "Support"
    EMPLOYEE = "EMPLOYEE", "Employee"


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email: str, password: str | None = None, **extra_fields):
        if not email:
            raise ValueError("Email is required.")
        email = self.normalize_email(email)
        extra_fields.setdefault("role", RoleChoices.EMPLOYEE)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email: str, password: str, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", RoleChoices.OWNER)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Enterprise user. Tenant membership via ``organization``."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, db_index=True)
    username = models.CharField(max_length=150, unique=True, null=True, blank=True)
    first_name = models.CharField(max_length=150, blank=True, default="")
    last_name = models.CharField(max_length=150, blank=True, default="")
    profile_photo = models.ImageField(
        upload_to="avatars/%Y/%m/", null=True, blank=True
    )
    organization = models.ForeignKey(
        "organizations.Organization",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="members",
        help_text="Null only for the break-glass platform superuser.",
    )
    department = models.ForeignKey(
        "organizations.Department",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="members",
    )
    role = models.CharField(
        max_length=16, choices=RoleChoices.choices, default=RoleChoices.EMPLOYEE, db_index=True
    )
    job_title = models.CharField(max_length=120, blank=True, default="")
    # Forward-compatible scoping for Phase 3/4 RAG + agent filtering.
    knowledge_scope = models.JSONField(default=list, blank=True)
    agent_scope = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_email_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    objects = UserManager()

    class Meta:
        db_table = "users"
        ordering = ["email"]
        indexes = [
            models.Index(fields=["organization", "role"]),
            models.Index(fields=["organization", "department"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self) -> str:  # pragma: no cover - trivial
        return f"{self.email} ({self.role})"

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def name(self) -> str:
        return self.full_name or self.email

    def get_full_name(self) -> str:
        return self.full_name or self.email

    def get_short_name(self) -> str:
        return self.first_name or self.email
