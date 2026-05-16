from datetime import datetime, UTC
from enum import Enum
from uuid import uuid4

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class BlogPostStatus(str, Enum):
    DRAFT = "draft"
    REVIEW = "review"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class BlogPostVisibility(str, Enum):
    PUBLIC = "public"
    UNLISTED = "unlisted"
    PRIVATE = "private"


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


class AppSetting(Base):
    __tablename__ = "app_settings"

    key = Column(String(128), primary_key=True, nullable=False, unique=True, index=True)
    value = Column(Text, nullable=False)
    is_secret = Column(Boolean, nullable=False, default=False)
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))


class BlogPost(Base):
    __tablename__ = "blog_posts"
    __table_args__ = (
        CheckConstraint(
            "(status = 'scheduled' AND scheduled_at IS NOT NULL) OR (status != 'scheduled')",
            name="ck_blog_posts_scheduled_requires_scheduled_at",
        ),
        CheckConstraint(
            "status IN ('draft', 'review', 'scheduled', 'published', 'archived')",
            name="ck_blog_posts_status",
        ),
        CheckConstraint(
            "visibility IN ('public', 'unlisted', 'private')",
            name="ck_blog_posts_visibility",
        ),
        Index("ix_blog_posts_status", "status"),
        Index("ix_blog_posts_published_at", "published_at"),
        Index("ix_blog_posts_author_email", "author_email"),
        Index("ix_blog_posts_updated_at", "updated_at"),
    )

    id = Column(String(36), primary_key=True, nullable=False, default=lambda: str(uuid4()))
    slug = Column(String(128), nullable=False, unique=True, index=True)
    title = Column(String(200), nullable=False)
    excerpt = Column(String(320), nullable=True)
    content_markdown = Column(Text, nullable=False)
    content_json = Column(Text, nullable=True)

    status = Column(String(24), nullable=False, default=BlogPostStatus.DRAFT.value)
    visibility = Column(String(24), nullable=False, default=BlogPostVisibility.PRIVATE.value)

    seo_title = Column(String(70), nullable=True)
    seo_description = Column(String(160), nullable=True)
    canonical_url = Column(String(1024), nullable=True)
    cover_image_url = Column(String(1024), nullable=True)
    locale = Column(String(16), nullable=False, default="en")

    author_email = Column(String(255), ForeignKey("users.email"), nullable=False)
    last_edited_by_email = Column(String(255), ForeignKey("users.email"), nullable=True)

    published_at = Column(DateTime, nullable=True)
    scheduled_at = Column(DateTime, nullable=True)

    version = Column(Integer, nullable=False, default=1)
    ai_summary = Column(Text, nullable=True)
    ai_keywords_json = Column(Text, nullable=True)

    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))
    deleted_at = Column(DateTime, nullable=True)


class BillingCustomer(Base):
    __tablename__ = "billing_customers"

    id = Column(String(36), primary_key=True, nullable=False, default=lambda: str(uuid4()))
    user_email = Column(String(255), nullable=False, unique=True, index=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))


class BillingTransaction(Base):
    __tablename__ = "billing_transactions"
    __table_args__ = (
        Index("ix_billing_transactions_provider_occurred_at", "provider", "occurred_at"),
        Index("ix_billing_transactions_status", "status_canonical"),
        Index("ix_billing_transactions_type", "transaction_type"),
        Index("ix_billing_transactions_customer_id", "customer_id"),
        Index("ix_billing_transactions_provider_txn", "provider_transaction_id"),
    )

    id = Column(String(36), primary_key=True, nullable=False, default=lambda: str(uuid4()))
    customer_id = Column(String(36), ForeignKey("billing_customers.id"), nullable=True)
    payer_email = Column(String(255), nullable=True)
    provider = Column(String(24), nullable=False)
    provider_transaction_id = Column(String(128), nullable=False)
    provider_order_id = Column(String(128), nullable=True)
    provider_subscription_id = Column(String(128), nullable=True)
    transaction_type = Column(String(24), nullable=False)
    currency = Column(String(12), nullable=False)
    amount_minor = Column(Integer, nullable=False, default=0)
    status_canonical = Column(String(24), nullable=False)
    status_provider_raw = Column(String(64), nullable=True)
    occurred_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))


class BillingWebhookEvent(Base):
    __tablename__ = "billing_webhook_events"
    __table_args__ = (
        Index("ix_billing_webhook_provider_event", "provider", "provider_event_id", unique=True),
    )

    id = Column(String(36), primary_key=True, nullable=False, default=lambda: str(uuid4()))
    provider = Column(String(24), nullable=False)
    provider_event_id = Column(String(255), nullable=False)
    event_type = Column(String(128), nullable=False)
    signature_verified = Column(Boolean, nullable=False, default=False)
    payload_sha256 = Column(String(64), nullable=False)
    processed = Column(Boolean, nullable=False, default=False)
    processed_at = Column(DateTime, nullable=True)
    received_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))


class BillingAuditLog(Base):
    __tablename__ = "billing_audit_logs"
    __table_args__ = (
        Index("ix_billing_audit_logs_created_at", "created_at"),
        Index("ix_billing_audit_logs_entity", "entity_type", "entity_id"),
    )

    id = Column(String(36), primary_key=True, nullable=False, default=lambda: str(uuid4()))
    actor_email = Column(String(255), nullable=False)
    action = Column(String(64), nullable=False)
    entity_type = Column(String(64), nullable=False)
    entity_id = Column(String(128), nullable=False)
    metadata_json = Column(Text, nullable=False, default="{}")
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
