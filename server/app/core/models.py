from datetime import datetime, UTC
from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    email = Column(String(255), primary_key=True, nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="viewer")
    is_verified = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    email = Column(String(255), primary_key=True, nullable=False, unique=True, index=True)
    token_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))


class EmailChallenge(Base):
    __tablename__ = "email_challenges"

    token_hash = Column(String(255), primary_key=True, nullable=False, unique=True, index=True)
    email = Column(String(255), nullable=False, index=True)
    purpose = Column(String(32), nullable=False)
    redirect_path = Column(String(512), nullable=True)
    expires_at = Column(DateTime, nullable=False)
    consumed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
