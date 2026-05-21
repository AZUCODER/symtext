from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

BlogStatus = Literal["draft", "review", "scheduled", "published", "archived"]
BlogVisibility = Literal["public", "unlisted", "private"]


class BlogCreateRequest(BaseModel):
    slug: str = Field(min_length=3, max_length=128)
    title: str = Field(min_length=3, max_length=200)
    excerpt: str | None = Field(default=None, max_length=320)
    content_markdown: str = Field(min_length=1, max_length=200000)
    content_json: str | None = Field(default=None, max_length=300000)

    status: BlogStatus = "draft"
    visibility: BlogVisibility = "private"

    seo_title: str | None = Field(default=None, max_length=70)
    seo_description: str | None = Field(default=None, max_length=160)
    canonical_url: str | None = Field(default=None, max_length=1024)
    cover_image_url: str | None = Field(default=None, max_length=1024)
    locale: str = Field(default="en", min_length=2, max_length=16)

    published_at: datetime | None = None
    scheduled_at: datetime | None = None

    ai_summary: str | None = Field(default=None, max_length=5000)
    ai_keywords_json: str | None = Field(default=None, max_length=20000)

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not normalized:
            raise ValueError("Slug is required")

        import re

        if not re.fullmatch(r"^[a-z0-9]+(?:-[a-z0-9]+)*$", normalized):
            raise ValueError("Slug must contain lowercase letters, numbers, and hyphens only")
        return normalized

    @field_validator("canonical_url", "cover_image_url")
    @classmethod
    def validate_optional_url(cls, value: str | None) -> str | None:
        if value is None:
            return None

        if not (value.startswith("http://") or value.startswith("https://")):
            raise ValueError("URL must start with http:// or https://")
        return value

    @model_validator(mode="after")
    def validate_schedule_fields(self) -> "BlogCreateRequest":
        if self.status == "scheduled" and self.scheduled_at is None:
            raise ValueError("scheduled_at is required when status is scheduled")

        if self.scheduled_at is not None:
            candidate = self.scheduled_at
            if candidate.tzinfo is None:
                candidate = candidate.replace(tzinfo=UTC)
            if candidate <= datetime.now(UTC):
                raise ValueError("scheduled_at must be in the future")

        return self


class BlogUpdateRequest(BaseModel):
    slug: str | None = Field(default=None, min_length=3, max_length=128)
    title: str | None = Field(default=None, min_length=3, max_length=200)
    excerpt: str | None = Field(default=None, max_length=320)
    content_markdown: str | None = Field(default=None, min_length=1, max_length=200000)
    content_json: str | None = Field(default=None, max_length=300000)

    status: BlogStatus | None = None
    visibility: BlogVisibility | None = None

    seo_title: str | None = Field(default=None, max_length=70)
    seo_description: str | None = Field(default=None, max_length=160)
    canonical_url: str | None = Field(default=None, max_length=1024)
    cover_image_url: str | None = Field(default=None, max_length=1024)
    locale: str | None = Field(default=None, min_length=2, max_length=16)

    scheduled_at: datetime | None = None
    ai_summary: str | None = Field(default=None, max_length=5000)
    ai_keywords_json: str | None = Field(default=None, max_length=20000)

    expected_version: int | None = Field(default=None, ge=1)

    @field_validator("canonical_url", "cover_image_url")
    @classmethod
    def validate_optional_url(cls, value: str | None) -> str | None:
        if value is None:
            return None

        if not (value.startswith("http://") or value.startswith("https://")):
            raise ValueError("URL must start with http:// or https://")
        return value

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, value: str | None) -> str | None:
        if value is None:
            return None

        normalized = value.strip().lower()
        import re

        if not re.fullmatch(r"^[a-z0-9]+(?:-[a-z0-9]+)*$", normalized):
            raise ValueError("Slug must contain lowercase letters, numbers, and hyphens only")
        return normalized


class BlogPublishRequest(BaseModel):
    publish_at: datetime | None = None
    schedule_at: datetime | None = None

    @model_validator(mode="after")
    def validate_dates(self) -> "BlogPublishRequest":
        if self.publish_at is not None and self.schedule_at is not None:
            raise ValueError("Provide either publish_at or schedule_at, not both")

        now = datetime.now(UTC)

        for value, field_name in ((self.publish_at, "publish_at"), (self.schedule_at, "schedule_at")):
            if value is None:
                continue

            candidate = value
            if candidate.tzinfo is None:
                candidate = candidate.replace(tzinfo=UTC)

            if candidate <= now:
                raise ValueError(f"{field_name} must be in the future")

        return self


class BlogResponse(BaseModel):
    id: str
    slug: str
    title: str
    excerpt: str | None
    content_markdown: str
    content_json: str | None

    status: BlogStatus
    visibility: BlogVisibility

    seo_title: str | None
    seo_description: str | None
    canonical_url: str | None
    cover_image_url: str | None
    locale: str

    author_email: str
    last_edited_by_email: str | None

    published_at: datetime | None
    scheduled_at: datetime | None

    version: int
    ai_summary: str | None
    ai_keywords_json: str | None

    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None


class BlogListResponse(BaseModel):
    items: list[BlogResponse]
    page: int
    page_size: int
    total: int
