from collections.abc import Callable
from typing import Literal

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.services.auth_service import UserService
from app.schemas.auth import UserProfile

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/verify-email")
optional_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/verify-email", auto_error=False)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> UserProfile:
    email = decode_access_token(token)
    user = UserService.get_user(db, email)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User no longer exists")

    if not user.is_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email is not verified")

    return UserProfile(
        name=user.name,
        email=user.email,
        role=user.role,
        is_verified=user.is_verified,
    )


def get_optional_current_user(
    token: str | None = Depends(optional_oauth2_scheme),
    db: Session = Depends(get_db),
) -> UserProfile | None:
    if token is None:
        return None

    try:
        email = decode_access_token(token)
    except HTTPException:
        return None

    user = UserService.get_user(db, email)
    if user is None or not user.is_verified:
        return None

    return UserProfile(
        name=user.name,
        email=user.email,
        role=user.role,
        is_verified=user.is_verified,
    )


UserRole = Literal["viewer", "editor", "admin"]


def require_roles(roles: set[UserRole]) -> Callable[[UserProfile], UserProfile]:
    def dependency(current_user: UserProfile = Depends(get_current_user)) -> UserProfile:
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return current_user

    return dependency
