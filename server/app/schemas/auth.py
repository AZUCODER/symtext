from pydantic import BaseModel, EmailStr, Field
from typing import Literal

UserRole = Literal["viewer", "editor", "admin"]


class RegisterRequest(BaseModel):
    email: EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    next: str | None = None


class UserProfile(BaseModel):
    name: str
    email: EmailStr
    role: UserRole
    is_verified: bool


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserProfile


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class LogoutRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class MessageResponse(BaseModel):
    message: str


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=1)


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class UpdateUserRoleRequest(BaseModel):
    email: EmailStr
    role: UserRole


class UserListResponse(BaseModel):
    users: list[UserProfile]


class RoleAuditEvent(BaseModel):
    actor_email: EmailStr
    target_email: EmailStr
    previous_role: UserRole
    new_role: UserRole
    changed_at: str


class RoleAuditListResponse(BaseModel):
    events: list[RoleAuditEvent]
