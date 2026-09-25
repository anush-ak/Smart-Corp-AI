"""Organisation + Department models (multi-tenant root).

NOTE: ``Department.manager`` is added in migration ``0002`` on purpose —
accounts.User already FKs to Organization, so defining the reverse FK in the
same initial migration would create a circular dependency.
"""

from __future__ import annotations

import uuid

from django.db import models
from django.utils.text import slugify


class PlanChoices(models.TextChoices):
    FREE = "free", "Free"
    STARTER = "starter", "Starter"
    BUSINESS = "business", "Business"
    ENTERPRISE = "enterprise", "Enterprise"


class Organization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=120, unique=True, blank=True)
    logo = models.ImageField(upload_to="org_logos/%Y/", null=True, blank=True)
    industry = models.CharField(max_length=120, blank=True, default="")
    timezone = models.CharField(max_length=64, default="UTC")
    plan = models.CharField(
        max_length=16, choices=PlanChoices.choices, default=PlanChoices.ENTERPRISE
    )
    # Web-client contract fields (also useful operationally).
    domain = models.CharField(max_length=255, blank=True, default="")
    data_region = models.CharField(max_length=120, blank=True, default="")
    mfa_required = models.BooleanField(default=False)
    settings = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "organizations"
        ordering = ["name"]
        indexes = [models.Index(fields=["slug"])]

    def __str__(self) -> str:  # pragma: no cover - trivial
        return self.name

    def save(self, *args, **kwargs) -> None:
        if not self.slug:
            base = slugify(self.name)[:100] or "org"
            candidate, counter = base, 2
            while (
                Organization.objects.filter(slug=candidate).exclude(pk=self.pk).exists()
            ):
                candidate = f"{base}-{counter}"
                counter += 1
            self.slug = candidate
        super().save(*args, **kwargs)


class Department(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="departments"
    )
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True, default="")
    manager = models.ForeignKey(
        "accounts.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="managed_departments",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "departments"
        ordering = ["name"]
        indexes = [models.Index(fields=["organization"])]
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "name"], name="uniq_department_org_name"
            )
        ]

    def __str__(self) -> str:  # pragma: no cover - trivial
        return f"{self.name} ({self.organization})"
