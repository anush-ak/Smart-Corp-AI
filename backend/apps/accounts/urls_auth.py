"""Auth routes: /api/v1/auth/... (and legacy /api/auth/...)."""

from django.urls import path

from .views_auth import (
    ChangePasswordView,
    DemoAccountsView,
    EmailVerifyConfirmView,
    EmailVerifyRequestView,
    LoginView,
    LogoutView,
    MeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RefreshView,
    SessionView,
    SwitchRoleView,
)

urlpatterns = [
    path("login/", LoginView.as_view(), name="auth-login"),
    path("refresh/", RefreshView.as_view(), name="auth-refresh"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("session/", SessionView.as_view(), name="auth-session"),
    path("me/", MeView.as_view(), name="auth-me"),
    path("change-password/", ChangePasswordView.as_view(), name="auth-change-password"),
    path("password-reset/", PasswordResetRequestView.as_view(), name="auth-password-reset"),
    path(
        "password-reset/confirm/",
        PasswordResetConfirmView.as_view(),
        name="auth-password-reset-confirm",
    ),
    path("verify-email/", EmailVerifyRequestView.as_view(), name="auth-verify-email"),
    path(
        "verify-email/confirm/",
        EmailVerifyConfirmView.as_view(),
        name="auth-verify-email-confirm",
    ),
    path("demo-accounts/", DemoAccountsView.as_view(), name="auth-demo-accounts"),
    path("switch-role/", SwitchRoleView.as_view(), name="auth-switch-role"),
]
