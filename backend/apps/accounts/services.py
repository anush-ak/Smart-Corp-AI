"""Auth + user-management business logic.

Views are thin: they validate input with serializers, call into
:class:`AuthService`, and render the result. Nothing here trusts
frontend-supplied organisation IDs, roles or permissions.
"""

from __future__ import annotations

import secrets

from django.conf import settings
from django.contrib.auth import password_validation
from django.contrib.auth.models import update_last_login
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.db import transaction
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from common.logging_utils import get_logger
from services.security import (
    ensure_same_organization,
    get_frontend_permissions,
    get_user_permissions,
)
from services.security.permissions import ROLE_METADATA, ROLE_RANK

from .models import RoleChoices, User

logger = get_logger("accounts.auth")


def _role_definitions() -> list[dict]:
    """All role definitions for session/roles responses (rank ordered)."""
    definitions = []
    for role in sorted(ROLE_RANK, key=ROLE_RANK.get):  # type: ignore[arg-type]
        meta = ROLE_METADATA[role]
        definitions.append(
            {
                "role": role.lower(),
                "label": meta["label"],
                "summary": meta["summary"],
                "permissions": get_frontend_permissions(role),
                "knowledge_scope_description": meta["knowledge_scope_description"],
            }
        )
    return definitions


class AuthService:
    """Central authentication + user administration service."""

    # -- Tokens & sessions -------------------------------------------------
    @staticmethod
    def authenticate(email: str, password: str) -> User:
        """Validate credentials. Generic error — never leak which part failed."""
        normalized = User.objects.normalize_email(email or "")
        user = User.objects.filter(email__iexact=normalized).first()
        if user is None or not password or not user.check_password(password):
            raise AuthenticationFailed("Invalid email or password.")
        if not user.is_active:
            raise AuthenticationFailed("This account is disabled.")
        return user

    @staticmethod
    def issue_token_pair(user: User) -> dict[str, str]:
        refresh = RefreshToken.for_user(user)
        # Mirror identity claims for downstream services (backend verified).
        refresh["email"] = user.email
        refresh["role"] = user.role
        refresh["org_id"] = str(user.organization_id) if user.organization_id else ""
        return {"refresh": str(refresh), "access": str(refresh.access_token)}

    @staticmethod
    def build_session(user: User) -> dict:
        """Session payload: identity + org + roles + effective permissions."""
        # Local imports: serializers import services? No — but keep decoupled.
        from .serializers_session import (
            SessionOrganizationSerializer,
            SessionUserSerializer,
        )

        organization = getattr(user, "organization", None)
        return {
            "user": SessionUserSerializer(user).data,
            "organization": (
                SessionOrganizationSerializer(organization).data if organization else None
            ),
            "roles": _role_definitions(),
            "permissions": sorted(get_user_permissions(user)),
            "frontend_permissions": get_frontend_permissions(
                sorted(get_user_permissions(user))
            ),
        }

    @classmethod
    def login(cls, email: str, password: str) -> dict:
        user = cls.authenticate(email, password)
        update_last_login(None, user)
        pair = cls.issue_token_pair(user)
        # `token` is the legacy alias the current web client stores.
        return {"token": pair["access"], **pair, **cls.build_session(user)}

    @staticmethod
    def logout(refresh_token: str | None) -> None:
        """Blacklist a refresh token. Idempotent — logout never fails hard."""
        if not refresh_token:
            return
        try:
            RefreshToken(refresh_token).blacklist()
        except TokenError:
            # Already expired/invalid → effectively logged out.
            pass

    # -- Profile & password ------------------------------------------------
    @staticmethod
    def update_profile(user: User, validated_data: dict) -> User:
        allowed = {"first_name", "last_name", "username", "job_title", "profile_photo"}
        for field, value in validated_data.items():
            if field in allowed:
                setattr(user, field, value)
        user.save(update_fields=[f for f in allowed if f in validated_data] or None)
        return user

    @staticmethod
    def change_password(user: User, current_password: str, new_password: str) -> None:
        if not user.check_password(current_password or ""):
            raise ValidationError({"current_password": ["Current password is incorrect."]})
        try:
            password_validation.validate_password(new_password, user)
        except DjangoValidationError as exc:
            raise ValidationError({"new_password": list(exc.messages)})
        user.set_password(new_password)
        user.save(update_fields=["password"])

    # -- Password reset (token architecture; console email in dev) ---------
    @staticmethod
    def _send_mail(subject: str, body: str, recipient: str) -> None:
        send_mail(
            subject,
            body,
            settings.DEFAULT_FROM_EMAIL,
            [recipient],
            fail_silently=True,
        )

    @classmethod
    def request_password_reset(cls, email: str) -> dict | None:
        """Start a reset. Returns debug payload in DEBUG only; never leaks."""
        normalized = User.objects.normalize_email(email or "")
        user = User.objects.filter(email__iexact=normalized, is_active=True).first()
        if user is None:
            return None
        uid = urlsafe_base64_encode(force_bytes(str(user.pk)))
        token = default_token_generator.make_token(user)
        reset_url = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"
        cls._send_mail(
            "Reset your SmartCorp AI password",
            f"Hi {user.name},\n\nReset your password here:\n{reset_url}\n\n"
            "If you did not request this, ignore this email.",
            user.email,
        )
        logger.info("Password reset requested for user_id=%s", user.pk)
        if settings.DEBUG:
            return {"uid": uid, "token": token}
        return None

    @staticmethod
    def confirm_password_reset(uid: str, token: str, new_password: str) -> None:
        try:
            pk = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=pk, is_active=True)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            raise ValidationError({"token": ["Invalid or expired reset link."]})
        if not default_token_generator.check_token(user, token):
            raise ValidationError({"token": ["Invalid or expired reset link."]})
        try:
            password_validation.validate_password(new_password, user)
        except DjangoValidationError as exc:
            raise ValidationError({"new_password": list(exc.messages)})
        user.set_password(new_password)
        user.save(update_fields=["password"])
        logger.info("Password reset completed for user_id=%s", user.pk)

    # -- Email verification architecture -----------------------------------
    @classmethod
    def request_email_verification(cls, user: User) -> str | None:
        from django.core.signing import TimestampSigner

        token = TimestampSigner(salt="smartcorp-email-verify").sign(str(user.pk))
        verify_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
        cls._send_mail(
            "Verify your SmartCorp AI email",
            f"Hi {user.name},\n\nVerify your email here:\n{verify_url}",
            user.email,
        )
        return token if settings.DEBUG else None

    @staticmethod
    def confirm_email_verification(token: str) -> User:
        from django.core.signing import BadSignature, SignatureExpired, TimestampSigner

        try:
            pk = TimestampSigner(salt="smartcorp-email-verify").unsign(
                token, max_age=60 * 60 * 24
            )
            user = User.objects.get(pk=pk)
        except (BadSignature, SignatureExpired, User.DoesNotExist, ValueError):
            raise ValidationError({"token": ["Invalid or expired verification link."]})
        user.is_email_verified = True
        user.save(update_fields=["is_email_verified"])
        return user

    # -- User administration (RBAC-guarded) --------------------------------
    @staticmethod
    def _rank(role: str | None) -> int:
        return ROLE_RANK.get(str(role or "").upper(), len(ROLE_RANK))

    @classmethod
    def _assert_may_grant_role(cls, actor: User, role: str | None) -> str:
        """Actors may only grant roles at or below their own privilege."""
        normalized = str(role or RoleChoices.EMPLOYEE).upper()
        if normalized not in RoleChoices.values:
            raise ValidationError({"role": [f"Unknown role '{role}'."]})
        if actor.is_superuser:
            return normalized
        if cls._rank(normalized) < cls._rank(actor.role):
            raise ValidationError(
                {"role": ["You cannot grant a role above your own."]}
            )
        return normalized

    @classmethod
    @transaction.atomic
    def create_user(cls, actor: User, validated_data: dict) -> User:
        from apps.organizations.models import Department

        data = dict(validated_data)
        role = cls._assert_may_grant_role(actor, data.pop("role", RoleChoices.EMPLOYEE))
        department = data.pop("department", None)
        if department is not None:
            if not isinstance(department, Department):
                department = Department.objects.filter(pk=department).first()
            if department is None or department.organization_id != actor.organization_id:
                raise ValidationError(
                    {"department": ["Department must belong to your organisation."]}
                )
        password = data.pop("password", "") or secrets.token_urlsafe(12)
        user = User(
            organization=actor.organization,  # never trust client org IDs
            role=role,
            department=department,
            **{k: v for k, v in data.items() if k != "department_id"},
        )
        try:
            password_validation.validate_password(password, user)
        except DjangoValidationError as exc:
            raise ValidationError({"password": list(exc.messages)})
        user.set_password(password)
        user.save()
        logger.info(
            "User created: user_id=%s org_id=%s role=%s by=%s",
            user.pk,
            actor.organization_id,
            role,
            actor.pk,
        )
        return user

    @classmethod
    @transaction.atomic
    def update_user(cls, actor: User, target: User, validated_data: dict) -> User:
        ensure_same_organization(actor, target)
        data = dict(validated_data)
        data.pop("organization", None)
        data.pop("organization_id", None)
        # Privilege fields are superuser-only; silently strip otherwise.
        if not actor.is_superuser:
            data.pop("is_superuser", None)
            data.pop("is_staff", None)
            data.pop("groups", None)
            data.pop("user_permissions", None)

        if "role" in data and data["role"] is not None:
            if str(target.pk) == str(actor.pk):
                raise ValidationError({"role": ["You cannot change your own role."]})
            new_role = cls._assert_may_grant_role(actor, data["role"])
            if target.role == RoleChoices.OWNER and new_role != RoleChoices.OWNER:
                cls._assert_not_last_owner(target)
            data["role"] = new_role

        if "department" in data:
            department = data["department"]
            if department is not None and department.organization_id != actor.organization_id:
                raise ValidationError(
                    {"department": ["Department must belong to your organisation."]}
                )
            target.department = department
            del data["department"]

        for field, value in data.items():
            if hasattr(target, field):
                setattr(target, field, value)
        target.save()
        return target

    @staticmethod
    def _assert_not_last_owner(target: User) -> None:
        owners = User.objects.filter(
            organization_id=target.organization_id,
            role=RoleChoices.OWNER,
            is_active=True,
        ).exclude(pk=target.pk)
        if not owners.exists():
            raise ValidationError(
                {"role": ["An organisation must keep at least one active Owner."]}
            )

    @classmethod
    @transaction.atomic
    def delete_user(cls, actor: User, target: User) -> None:
        ensure_same_organization(actor, target)
        if str(target.pk) == str(actor.pk):
            raise ValidationError({"detail": ["You cannot delete your own account."]})
        if target.role == RoleChoices.OWNER:
            cls._assert_not_last_owner(target)
        logger.info("User deleted: user_id=%s by=%s", target.pk, actor.pk)
        target.delete()

    @classmethod
    def update_scope(
        cls,
        actor: User,
        target: User,
        *,
        role=None,
        knowledge_scope=None,
        agent_scope=None,
    ) -> User:
        """Update a member's role and retrieval scopes (Phase 3/4 ready)."""
        payload: dict = {}
        if role is not None:
            payload["role"] = role
        if knowledge_scope is not None:
            if not isinstance(knowledge_scope, list):
                raise ValidationError({"knowledge_scope": ["Must be a list."]})
            payload["knowledge_scope"] = knowledge_scope
        if agent_scope is not None:
            if not isinstance(agent_scope, list):
                raise ValidationError({"agent_scope": ["Must be a list."]})
            payload["agent_scope"] = agent_scope
        return cls.update_user(actor, target, payload)
