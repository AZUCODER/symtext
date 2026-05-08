from urllib.parse import quote

import resend
from fastapi import HTTPException, status

from app.core.config import get_settings


def send_verification_email(email: str, name: str, token: str, purpose: str, redirect_path: str | None = None) -> None:
    settings = get_settings()

    if not settings.resend_api_key or not settings.resend_from_email:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Email provider is not configured",
        )

    verify_link = f"{settings.app_base_url.rstrip('/')}/verify?token={quote(token)}"
    if redirect_path and redirect_path.startswith("/"):
        verify_link = f"{verify_link}&next={quote(redirect_path)}"

    action_label = "finish signing in" if purpose == "login" else "activate your account"

    resend.api_key = settings.resend_api_key
    resend.Emails.send(
        {
            "from": settings.resend_from_email,
            "to": [email],
            "subject": "Verify your Symtext account",
            "html": (
                f"<p>Hi {name},</p>"
                f"<p>Use this link to {action_label}:</p>"
                f"<p><a href=\"{verify_link}\">Verify email</a></p>"
                "<p>If you did not request this, you can ignore this message.</p>"
            ),
        }
    )
