"""Seed the SmartCorp demo organisation, departments and users.

Usage:
    python manage.py seed_demo_data [--reset-passwords]

Passwords come from SMARTCORP_DEMO_PASSWORD, else a secure random value is
generated and printed ONCE. Existing users keep their passwords unless
--reset-passwords is passed. Idempotent — safe to re-run.
"""

from __future__ import annotations

import os
import secrets

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

DEMO_ORG_SLUG = "smartcorp-demo"

DEPARTMENTS = [
    ("HR", "People operations, policies and onboarding."),
    ("Finance", "Budgets, expenses and procurement."),
    ("Engineering", "Product and platform engineering."),
    ("Operations", "Day-to-day business operations."),
    ("Support", "Customer and internal IT support."),
]

# email, first, last, role, department, job title
DEMO_USERS = [
    ("owner@smartcorp.demo", "Ananya", "Iyer", "OWNER", "Operations", "Founder & CEO"),
    ("admin@smartcorp.demo", "Vikram", "Rao", "ADMIN", "Operations", "Platform Administrator"),
    ("hr@smartcorp.demo", "Priya", "Nair", "HR", "HR", "Head of People Operations"),
    ("manager@smartcorp.demo", "Rohan", "Sharma", "MANAGER", "Engineering", "Engineering Manager"),
    ("finance@smartcorp.demo", "Kavya", "Menon", "FINANCE", "Finance", "Financial Controller"),
    ("support@smartcorp.demo", "Arjun", "Patel", "SUPPORT", "Support", "Support Operations Lead"),
    ("employee@smartcorp.demo", "Devika", "Rao", "EMPLOYEE", "Engineering", "Senior Engineer"),
]

KNOWLEDGE_SCOPE = {
    "OWNER": ["*"],
    "ADMIN": ["*"],
    "HR": ["kb_hr", "kb_product"],
    "MANAGER": ["kb_product", "kb_eng"],
    "FINANCE": ["kb_finance", "kb_product"],
    "SUPPORT": ["kb_support", "kb_product"],
    "EMPLOYEE": ["kb_hr", "kb_eng"],
}

AGENT_SCOPE = {
    "OWNER": ["*"],
    "ADMIN": ["*"],
    "HR": ["agent_hr"],
    "MANAGER": ["agent_hr"],
    "FINANCE": ["agent_finance"],
    "SUPPORT": ["agent_support"],
    "EMPLOYEE": [],
}


class Command(BaseCommand):
    help = "Seed the SmartCorp demo organisation, departments and users."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset-passwords",
            action="store_true",
            help="Reset passwords for existing demo users too.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        from apps.accounts.models import User
        from apps.organizations.models import Department, Organization

        password = os.environ.get("SMARTCORP_DEMO_PASSWORD", "")
        generated = False
        if not password:
            password = secrets.token_urlsafe(12)
            generated = True

        organization, _ = Organization.objects.update_or_create(
            slug=DEMO_ORG_SLUG,
            defaults={
                "name": "SmartCorp Demo",
                "industry": "Technology",
                "timezone": "UTC",
                "plan": "enterprise",
                "domain": "smartcorp.demo",
                "data_region": "ap-south-1 (Mumbai)",
                "mfa_required": False,
            },
        )

        departments: dict[str, Department] = {}
        for name, description in DEPARTMENTS:
            department, _ = Department.objects.update_or_create(
                organization=organization,
                name=name,
                defaults={"description": description},
            )
            departments[name] = department

        created, updated = 0, 0
        for email, first, last, role, dept_name, job_title in DEMO_USERS:
            user, is_new = User.objects.get_or_create(
                email=email,
                defaults={
                    "first_name": first,
                    "last_name": last,
                    "organization": organization,
                    "department": departments[dept_name],
                    "role": role,
                    "job_title": job_title,
                    "knowledge_scope": KNOWLEDGE_SCOPE[role],
                    "agent_scope": AGENT_SCOPE[role],
                    "is_active": True,
                    "is_staff": role in {"OWNER", "ADMIN"},
                    "is_email_verified": True,
                },
            )
            if is_new:
                user.set_password(password)
                user.save(update_fields=["password"])
                created += 1
            else:
                user.first_name = first
                user.last_name = last
                user.organization = organization
                user.department = departments[dept_name]
                user.role = role
                user.job_title = job_title
                user.knowledge_scope = KNOWLEDGE_SCOPE[role]
                user.agent_scope = AGENT_SCOPE[role]
                user.is_active = True
                user.is_staff = role in {"OWNER", "ADMIN"}
                if options["reset_passwords"]:
                    user.set_password(password)
                    user.save()
                else:
                    user.save()
                updated += 1

        # Department managers (manager field exists from migration 0002).
        try:
            hr_head = User.objects.get(email="hr@smartcorp.demo")
            manager = User.objects.get(email="manager@smartcorp.demo")
            Department.objects.filter(
                organization=organization, name="HR"
            ).update(manager=hr_head)
            Department.objects.filter(
                organization=organization, name="Engineering"
            ).update(manager=manager)
        except Exception as exc:  # pragma: no cover - defensive
            raise CommandError(f"Could not assign department managers: {exc}")

        self.stdout.write(self.style.SUCCESS(f"Organisation: {organization.name}"))
        self.stdout.write(f"Departments: {len(departments)}")
        self.stdout.write(f"Users created: {created}, updated: {updated}")
        self.stdout.write("")
        self.stdout.write("Demo logins:")
        for email, *_rest in DEMO_USERS:
            marker = ""
            if not generated and options["reset_passwords"] is False and updated:
                marker = ""
            self.stdout.write(f"  {email}{marker}")
        if generated:
            self.stdout.write(
                self.style.WARNING(
                    f"\nGenerated demo password (shown once): {password}\n"
                    "Set SMARTCORP_DEMO_PASSWORD to use a fixed password."
                )
            )
        else:
            self.stdout.write("\nPassword: from SMARTCORP_DEMO_PASSWORD.")
        if updated and not options["reset_passwords"]:
            self.stdout.write("Existing users kept their passwords (use --reset-passwords to rotate).")
