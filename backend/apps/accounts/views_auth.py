"""Auth endpoints — thin views over :class:`AuthService`."""

from __future__ import annotations

from django.conf import settings
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenRefreshView

from common.logging_utils import get_logger
from services.security.permissions import ROLE_RANK

from .models import User
from .serializers import (
    ChangePasswordSerializer,
    DemoSwitchSerializer,
    EmailVerifyConfirmSerializer,
    LoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    ProfileUpdateSerializer,
    RoleDefinitionSerializer,
    UserSerializer,
)
from .serializers_session import SessionOrganizationSerializer, SessionUserSerializer
from .services import AuthService, _role_definitions

logger = get_logger("accounts.views")


class LoginRateThrottle(SimpleRateThrottle):
    scope = "login"

    def get_cache_key(self, request, view):
        forwarded = request.headers.get("X-Forwarded-For", "")
        ident = forwarded.split(",")[0].strip() if forwarded else self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = AuthService.login(**serializer.validated_data)
        logger.info("Login success email=%s", serializer.validated_data["email"])
        return Response(payload, status=status.HTTP_200_OK)


class RefreshView(TokenRefreshView):
    """Refresh an access token; adds the legacy ``token`` alias."""

    throttle_classes: list = []

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200 and "access" in response.data:
            response.data["token"] = response.data["access"]
        return response


class LogoutView(APIView):
    """Blacklist the supplied refresh token. Always succeeds (idempotent)."""

    permission_classes = [AllowAny]

    def post(self, request):
        refresh = None
        if isinstance(request.data, dict):
            refresh = request.data.get("refresh")
        AuthService.logout(refresh)
        return Response({"detail": "Logged out."}, status=status.HTTP_200_OK)


class SessionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = (
            User.objects.select_related("organization", "department").get(pk=request.user.pk)
        )
        return Response(AuthService.build_session(user), status=status.HTTP_200_OK)


class MeView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = ProfileUpdateSerializer(
            data=request.data, partial=True, context={"user": request.user}
        )
        serializer.is_valid(raise_exception=True)
        user = AuthService.update_profile(request.user, serializer.validated_data)
        return Response(UserSerializer(user).data)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data, context={"user": request.user}
        )
        serializer.is_valid(raise_exception=True)
        AuthService.change_password(request.user, **serializer.validated_data)
        return Response({"detail": "Password changed."}, status=status.HTTP_200_OK)


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        debug = AuthService.request_password_reset(**serializer.validated_data)
        body: dict = {"detail": "If the email exists, a reset link was sent."}
        if debug is not None:  # DEBUG only — never in production
            body["debug"] = debug
        return Response(body, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        AuthService.confirm_password_reset(**serializer.validated_data)
        return Response({"detail": "Password has been reset."}, status=status.HTTP_200_OK)


class EmailVerifyRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = AuthService.request_email_verification(request.user)
        body: dict = {"detail": "If the email exists, a verification link was sent."}
        if token is not None:  # DEBUG only
            body["debug"] = {"token": token}
        return Response(body, status=status.HTTP_200_OK)


class EmailVerifyConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = EmailVerifyConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = AuthService.confirm_email_verification(**serializer.validated_data)
        return Response(
            {"detail": "Email verified.", "user_id": str(user.pk)},
            status=status.HTTP_200_OK,
        )


def _demo_guard() -> None:
    if not getattr(settings, "DEMO_ENDPOINTS_ENABLED", False):
        raise NotFound("Not found.")


class DemoAccountsView(APIView):
    """Demo aid only: sign-in identities for the login screen.

    Available solely when ``DEMO_ENDPOINTS_ENABLED`` is true (dev/demo —
    production returns 404). A real deployment uses SSO and removes this.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        _demo_guard()
        from apps.organizations.models import Organization

        organization = (
            Organization.objects.filter(slug="smartcorp-demo").first()
            or Organization.objects.order_by("created_at").first()
        )
        if organization is None:
            raise NotFound("No demo organisation has been seeded yet.")
        users = list(
            User.objects.filter(organization=organization, is_active=True)
            .select_related("department")
            .order_by("email")[:12]
        )
        users.sort(key=lambda u: (ROLE_RANK.get(u.role, 99), u.email))
        return Response(
            {
                "users": SessionUserSerializer(users, many=True).data,
                "organization": SessionOrganizationSerializer(organization).data,
            }
        )


class SwitchRoleView(APIView):
    """Demo aid only: mint a session for another demo user (no password)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        _demo_guard()
        serializer = DemoSwitchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            target = User.objects.select_related("organization", "department").get(
                pk=serializer.validated_data["user_id"],
                organization_id=request.user.organization_id,
                is_active=True,
            )
        except (User.DoesNotExist, ValueError):
            raise NotFound("Demo user not found.")
        logger.warning("Demo role switch by=%s to=%s", request.user.pk, target.pk)
        pair = AuthService.issue_token_pair(target)
        return Response({"token": pair["access"], **pair, **AuthService.build_session(target)})


class RolesView(APIView):
    """All role definitions with effective web-client permissions."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(RoleDefinitionSerializer(_role_definitions(), many=True).data)
