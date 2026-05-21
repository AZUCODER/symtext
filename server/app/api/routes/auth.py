import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.config import get_settings
from app.core.database import get_db
from app.core.models import User
from app.core.limiter import limiter
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_value,
)
from app.services.email_verification import send_verification_email
from app.services.auth_service import EmailChallengeService, RefreshTokenService, UserService
from app.schemas.auth import (
    AdminCreateUserRequest,
    AdminUpdateUserRequest,
    AuthResponse,
    LoginRequest,
    LogoutRequest,
    MessageResponse,
    RefreshRequest,
    ResendVerificationRequest,
    RoleAuditListResponse,
    RegisterRequest,
    UpdateUserRoleRequest,
    UserProfile,
    VerifyEmailRequest,
)
from app.schemas.auth import UserAdminProfile, UserAdminListResponse

router = APIRouter(prefix="/auth", tags=["auth"])

REGISTER_CHALLENGE_PURPOSE = "register"
LOGIN_CHALLENGE_PURPOSE = "login"
GENERIC_CHALLENGE_MESSAGE = "If the email can be used for this action, a verification link was sent"


def issue_tokens(name: str, email: str, role: str, is_verified: bool, db: Session) -> AuthResponse:
    access_token = create_access_token(email)
    refresh_token = create_refresh_token(email)
    RefreshTokenService.store_refresh_token(db, email, hash_value(refresh_token))

    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserProfile(name=name, email=email, role=role, is_verified=is_verified),
    )


def _normalize_next_path(next_path: str | None) -> str | None:
    if not next_path:
        return None

    if not next_path.startswith("/"):
        return None

    if next_path.startswith("//"):
        return None

    return next_path


def start_email_challenge(
    db: Session,
    user: User,
    purpose: str,
    next_path: str | None = None,
) -> None:
    settings = get_settings()
    raw_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(UTC) + timedelta(hours=settings.email_verification_expire_hours)

    normalized_next = _normalize_next_path(next_path)
    EmailChallengeService.store_challenge(
        db=db,
        email=user.email,
        token_hash=hash_value(raw_token),
        purpose=purpose,
        expires_at=expires_at,
        redirect_path=normalized_next,
    )
    send_verification_email(
        email=user.email,
        name=user.name,
        token=raw_token,
        purpose=purpose,
        redirect_path=normalized_next,
    )


def serialize_user(user: User) -> UserProfile:
    return UserProfile(
        name=user.name,
        email=user.email,
        role=user.role,
        is_verified=user.is_verified,
    )


def serialize_user_admin(user: User) -> UserAdminProfile:
    return UserAdminProfile(
        name=user.name,
        email=user.email,
        role=user.role,
        is_verified=user.is_verified,
        created_at=user.created_at.isoformat(),
        updated_at=user.updated_at.isoformat(),
    )


def ensure_verified_or_raise(user: User) -> None:
    if user.is_verified:
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Email is not verified",
    )


def issue_tokens_for_email(email: str, db: Session) -> AuthResponse:
    user = UserService.get_user(db, email)
    if user is None:
        raise HTTPException(status_code=401, detail="User no longer exists")

    ensure_verified_or_raise(user=user)
    return issue_tokens(
        name=user.name,
        email=email,
        role=user.role,
        is_verified=user.is_verified,
        db=db,
    )


@router.post("/register", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(request: Request, payload: RegisterRequest, db: Session = Depends(get_db)) -> MessageResponse:
    email_key = payload.email.lower()
    existing_user = UserService.get_user(db, email_key)
    if existing_user is not None:
        if existing_user.is_verified:
            raise HTTPException(status_code=409, detail="Email is already registered")

        start_email_challenge(db=db, user=existing_user, purpose=REGISTER_CHALLENGE_PURPOSE)
        return MessageResponse(message="Registration pending. Check your inbox to verify your email.")

    user = UserService.create_user(db, email=email_key)
    start_email_challenge(db=db, user=user, purpose=REGISTER_CHALLENGE_PURPOSE)
    return MessageResponse(message="Registration successful. Check your inbox to verify your email.")


@router.post("/login", response_model=MessageResponse)
@limiter.limit("10/minute")
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)) -> MessageResponse:
    email_key = payload.email.lower()
    user = UserService.get_user(db, email_key)
    if user is None:
        return MessageResponse(message=GENERIC_CHALLENGE_MESSAGE)

    if not user.is_verified:
        # Keep response non-enumerating while still helping real account owners verify.
        start_email_challenge(db=db, user=user, purpose=REGISTER_CHALLENGE_PURPOSE)
        return MessageResponse(message=GENERIC_CHALLENGE_MESSAGE)

    start_email_challenge(db=db, user=user, purpose=LOGIN_CHALLENGE_PURPOSE, next_path=payload.next)
    return MessageResponse(message=GENERIC_CHALLENGE_MESSAGE)


@router.post("/refresh", response_model=AuthResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> AuthResponse:
    email = decode_refresh_token(payload.refresh_token)
    if not RefreshTokenService.verify_refresh_token(db, email, hash_value(payload.refresh_token)):
        raise HTTPException(status_code=401, detail="Refresh token is invalid")

    return issue_tokens_for_email(email=email, db=db)


@router.post("/logout", response_model=MessageResponse)
def logout(payload: LogoutRequest, db: Session = Depends(get_db)) -> MessageResponse:
    email = decode_refresh_token(payload.refresh_token)
    RefreshTokenService.remove_refresh_token(db, email)
    return MessageResponse(message="Logged out")


@router.post("/verify-email", response_model=AuthResponse)
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)) -> AuthResponse:
    consumed = EmailChallengeService.consume_challenge(
        db=db,
        token_hash=hash_value(payload.token),
        purpose=LOGIN_CHALLENGE_PURPOSE,
    )

    if consumed is not None:
        email, _ = consumed
        return issue_tokens_for_email(email=email, db=db)

    consumed = EmailChallengeService.consume_challenge(
        db=db,
        token_hash=hash_value(payload.token),
        purpose=REGISTER_CHALLENGE_PURPOSE,
    )
    if consumed is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Verification token is invalid, expired, or already used",
        )

    email, _ = consumed
    user = UserService.get_user(db, email)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.is_verified:
        UserService.verify_user(db, email)

    return issue_tokens_for_email(email=email, db=db)


@router.post("/resend-verification", response_model=MessageResponse)
@limiter.limit("5/minute")
def resend_verification(request: Request, payload: ResendVerificationRequest, db: Session = Depends(get_db)) -> MessageResponse:
    email = payload.email.lower()
    user = UserService.get_user(db, email)
    if user is not None and not user.is_verified:
        start_email_challenge(db=db, user=user, purpose=REGISTER_CHALLENGE_PURPOSE)

    return MessageResponse(message=GENERIC_CHALLENGE_MESSAGE)


@router.get("/me", response_model=UserProfile)
def me(current_user: UserProfile = Depends(get_current_user)) -> UserProfile:
    return current_user


@router.get("/users", response_model=UserAdminListResponse)
def list_users(db: Session = Depends(get_db), current_user: UserProfile = Depends(get_current_user)) -> UserAdminListResponse:
    if current_user.role in {"admin", "editor"}:
        users = [serialize_user_admin(user) for user in UserService.get_all_users(db)]
    else:
        user = UserService.get_user(db, current_user.email)
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        users = [serialize_user_admin(user)]
    users.sort(key=lambda user: user.email)
    return UserAdminListResponse(users=users)


@router.post("/users", response_model=UserAdminProfile, status_code=status.HTTP_201_CREATED)
def create_user_by_admin(
    payload: AdminCreateUserRequest,
    db: Session = Depends(get_db),
    _admin_user: UserProfile = Depends(require_roles({"admin"})),
) -> UserAdminProfile:
    settings = get_settings()
    if payload.send_verification and not payload.is_verified:
        if not settings.resend_api_key or not settings.resend_from_email:
            raise HTTPException(
                status_code=400,
                detail="Email provider is not configured. Disable send verification or configure email settings.",
            )

    email = payload.email.lower()
    existing_user = UserService.get_user(db, email)
    if existing_user is not None:
        raise HTTPException(status_code=409, detail="User already exists")

    user = UserService.create_user_by_admin(
        db,
        email=email,
        name=payload.name,
        role=payload.role,
        is_verified=payload.is_verified,
    )
    if payload.send_verification and not payload.is_verified:
        start_email_challenge(db=db, user=user, purpose=REGISTER_CHALLENGE_PURPOSE)
    return serialize_user_admin(user)


@router.patch("/users/{email}", response_model=UserAdminProfile)
def update_user_by_admin(
    email: str,
    payload: AdminUpdateUserRequest,
    db: Session = Depends(get_db),
    admin_user: UserProfile = Depends(require_roles({"admin"})),
) -> UserAdminProfile:
    email = email.lower()
    target_user = UserService.get_user(db, email)
    if target_user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.name is None and payload.role is None and payload.is_verified is None:
        raise HTTPException(status_code=400, detail="No update fields provided")

    if payload.role is not None and target_user.role == "admin" and payload.role != "admin":
        admin_count = sum(1 for user in UserService.get_all_users(db) if user.role == "admin")
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot demote the last admin")

    if email == admin_user.email and payload.role is not None and payload.role != "admin":
        admin_count = sum(1 for user in UserService.get_all_users(db) if user.role == "admin")
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot demote the last admin")

    updated_user = UserService.update_user(
        db,
        email=email,
        name=payload.name,
        role=payload.role,
        is_verified=payload.is_verified,
    )
    if updated_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return serialize_user_admin(updated_user)


@router.patch("/users/role", response_model=UserAdminProfile)
def update_user_role(
    payload: UpdateUserRoleRequest,
    db: Session = Depends(get_db),
    admin_user: UserProfile = Depends(require_roles({"admin"})),
) -> UserAdminProfile:
    email = payload.email.lower()
    target_user = UserService.get_user(db, email)
    if target_user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if email == admin_user.email and payload.role != "admin":
        admin_count = sum(1 for user in UserService.get_all_users(db) if user.role == "admin")
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot demote the last admin")

    updated_user = UserService.update_user_role(db, email, payload.role)
    return serialize_user_admin(updated_user)


@router.delete("/users/{email}", response_model=MessageResponse, status_code=status.HTTP_200_OK)
def delete_user(
    email: str,
    db: Session = Depends(get_db),
    admin_user: UserProfile = Depends(require_roles({"admin"})),
) -> MessageResponse:
    email = email.lower()
    if email == admin_user.email:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    target_user = UserService.get_user(db, email)
    if target_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if target_user.role == "admin":
        admin_count = sum(1 for user in UserService.get_all_users(db) if user.role == "admin")
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last admin")
    UserService.delete_user(db, email)
    return MessageResponse(message=f"User {email} deleted")


@router.get("/users/role-audit", response_model=RoleAuditListResponse)
def list_role_audit(
    _operator_user: UserProfile = Depends(require_roles({"admin", "editor"})),
    limit: int = Query(default=50, ge=1, le=200),
) -> RoleAuditListResponse:
    # TODO: Implement role audit logging in database
    return RoleAuditListResponse(events=[])
