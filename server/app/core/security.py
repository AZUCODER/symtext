from datetime import UTC, datetime, timedelta
from hashlib import sha256

import jwt
from fastapi import HTTPException, status

from app.core.config import get_settings


def _create_token(subject: str, token_type: str, ttl: timedelta) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    expire_at = now + ttl
    payload = {
        "sub": subject,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int(expire_at.timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def _decode_token_subject(token: str, expected_type: str, error_detail: str) -> str:
    settings = get_settings()
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=error_detail,
    )

    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except jwt.InvalidTokenError as exc:
        raise credentials_exception from exc

    token_type = payload.get("type")
    if token_type != expected_type:
        raise credentials_exception

    subject = payload.get("sub")
    if not isinstance(subject, str) or not subject:
        raise credentials_exception

    return subject


def hash_value(value: str) -> str:
    return sha256(value.encode("utf-8")).hexdigest()


def create_access_token(subject: str) -> str:
    settings = get_settings()
    return _create_token(
        subject=subject,
        token_type="access",
        ttl=timedelta(minutes=settings.access_token_expire_minutes),
    )


def create_refresh_token(subject: str) -> str:
    settings = get_settings()
    return _create_token(
        subject=subject,
        token_type="refresh",
        ttl=timedelta(days=settings.refresh_token_expire_days),
    )


def decode_access_token(token: str) -> str:
    return _decode_token_subject(
        token=token,
        expected_type="access",
        error_detail="Could not validate credentials",
    )


def decode_refresh_token(token: str) -> str:
    return _decode_token_subject(
        token=token,
        expected_type="refresh",
        error_detail="Could not validate refresh token",
    )
