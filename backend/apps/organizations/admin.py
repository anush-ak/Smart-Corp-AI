"""Django admin for organisations and departments."""

from django.contrib import admin

from .models import Department, Organization


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "plan", "industry", "created_at")
    search_fields = ("name", "slug", "domain")
    list_filter = ("plan",)
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("name", "organization", "created_at")
    search_fields = ("name",)
    list_filter = ("organization",)
    readonly_fields = ("id", "created_at", "updated_at")
