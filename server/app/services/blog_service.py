from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.models import BlogPost, BlogPostStatus, BlogPostVisibility
from app.schemas.blog import BlogCreateRequest, BlogPublishRequest, BlogUpdateRequest


class BlogServiceError(Exception):
    pass


class BlogNotFoundError(BlogServiceError):
    pass


class BlogPermissionDenied(BlogServiceError):
    pass


class BlogValidationError(BlogServiceError):
    pass


class BlogConflictError(BlogServiceError):
    pass


class BlogService:
    NON_ADMIN_TRANSITIONS: dict[str, set[str]] = {
        BlogPostStatus.DRAFT.value: {
            BlogPostStatus.DRAFT.value,
            BlogPostStatus.REVIEW.value,
            BlogPostStatus.SCHEDULED.value,
            BlogPostStatus.PUBLISHED.value,
            BlogPostStatus.ARCHIVED.value,
        },
        BlogPostStatus.REVIEW.value: {
            BlogPostStatus.DRAFT.value,
            BlogPostStatus.REVIEW.value,
            BlogPostStatus.SCHEDULED.value,
            BlogPostStatus.PUBLISHED.value,
            BlogPostStatus.ARCHIVED.value,
        },
        BlogPostStatus.SCHEDULED.value: {
            BlogPostStatus.DRAFT.value,
            BlogPostStatus.REVIEW.value,
            BlogPostStatus.SCHEDULED.value,
            BlogPostStatus.PUBLISHED.value,
            BlogPostStatus.ARCHIVED.value,
        },
        BlogPostStatus.PUBLISHED.value: {
            BlogPostStatus.PUBLISHED.value,
            BlogPostStatus.ARCHIVED.value,
        },
        BlogPostStatus.ARCHIVED.value: {
            BlogPostStatus.ARCHIVED.value,
        },
    }

    @staticmethod
    def _now() -> datetime:
        return datetime.now(UTC)

    @staticmethod
    def _normalize_utc(value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)

    @staticmethod
    def _ensure_editor_or_admin(actor_role: str) -> None:
        if actor_role not in {"editor", "admin"}:
            raise BlogPermissionDenied("Editor or admin role required")

    @staticmethod
    def _ensure_transition_allowed(current_status: str, target_status: str, actor_role: str) -> None:
        if actor_role == "admin":
            return

        allowed = BlogService.NON_ADMIN_TRANSITIONS.get(current_status, {current_status})
        if target_status not in allowed:
            raise BlogValidationError(f"Invalid status transition from {current_status} to {target_status}")

    @staticmethod
    def _assert_status_schedule_consistency(status: str, scheduled_at: datetime | None) -> None:
        if status == BlogPostStatus.SCHEDULED.value and scheduled_at is None:
            raise BlogValidationError("scheduled_at is required when status is scheduled")

        if scheduled_at is not None:
            normalized = BlogService._normalize_utc(scheduled_at)
            if normalized <= BlogService._now():
                raise BlogValidationError("scheduled_at must be in the future")

    @staticmethod
    def _apply_public_filter(query):
        now = BlogService._now()
        return (
            query.filter(BlogPost.deleted_at.is_(None))
            .filter(BlogPost.status == BlogPostStatus.PUBLISHED.value)
            .filter(BlogPost.visibility == BlogPostVisibility.PUBLIC.value)
            .filter((BlogPost.published_at.is_(None)) | (BlogPost.published_at <= now))
        )

    @staticmethod
    def create_post(db: Session, payload: BlogCreateRequest, actor_email: str, actor_role: str) -> BlogPost:
        BlogService._ensure_editor_or_admin(actor_role)
        BlogService._assert_status_schedule_consistency(payload.status, payload.scheduled_at)

        exists = db.query(BlogPost).filter(BlogPost.slug == payload.slug).first()
        if exists is not None:
            raise BlogConflictError("Slug already exists")

        post = BlogPost(
            slug=payload.slug,
            title=payload.title,
            excerpt=payload.excerpt,
            content_markdown=payload.content_markdown,
            content_json=payload.content_json,
            status=payload.status,
            visibility=payload.visibility,
            seo_title=payload.seo_title,
            seo_description=payload.seo_description,
            canonical_url=payload.canonical_url,
            cover_image_url=payload.cover_image_url,
            locale=payload.locale,
            author_email=actor_email,
            last_edited_by_email=actor_email,
            published_at=payload.published_at,
            scheduled_at=payload.scheduled_at,
            version=1,
            ai_summary=payload.ai_summary,
            ai_keywords_json=payload.ai_keywords_json,
        )
        db.add(post)
        db.commit()
        db.refresh(post)
        return post

    @staticmethod
    def get_post_by_id(
        db: Session,
        post_id: str,
        *,
        include_deleted: bool = False,
        public_only: bool = False,
    ) -> BlogPost:
        query = db.query(BlogPost).filter(BlogPost.id == post_id)

        if public_only:
            query = BlogService._apply_public_filter(query)
        elif not include_deleted:
            query = query.filter(BlogPost.deleted_at.is_(None))

        post = query.first()
        if post is None:
            raise BlogNotFoundError("Blog post not found")
        return post

    @staticmethod
    def get_post_by_slug(
        db: Session,
        slug: str,
        *,
        include_deleted: bool = False,
        public_only: bool = False,
    ) -> BlogPost:
        query = db.query(BlogPost).filter(BlogPost.slug == slug)

        if public_only:
            query = BlogService._apply_public_filter(query)
        elif not include_deleted:
            query = query.filter(BlogPost.deleted_at.is_(None))

        post = query.first()
        if post is None:
            raise BlogNotFoundError("Blog post not found")
        return post

    @staticmethod
    def list_posts(
        db: Session,
        *,
        page: int,
        page_size: int,
        actor_role: str | None,
        status: str | None = None,
        author_email: str | None = None,
        locale: str | None = None,
        visibility: str | None = None,
        include_deleted: bool = False,
        public_only: bool = False,
    ) -> tuple[list[BlogPost], int]:
        query = db.query(BlogPost)

        if public_only or actor_role not in {"editor", "admin"}:
            query = BlogService._apply_public_filter(query)
        else:
            if not include_deleted:
                query = query.filter(BlogPost.deleted_at.is_(None))

            if status is not None:
                query = query.filter(BlogPost.status == status)
            if author_email is not None:
                query = query.filter(BlogPost.author_email == author_email.lower())
            if locale is not None:
                query = query.filter(BlogPost.locale == locale)
            if visibility is not None:
                query = query.filter(BlogPost.visibility == visibility)

        total = query.count()
        items = (
            query.order_by(BlogPost.updated_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return items, total

    @staticmethod
    def update_post(
        db: Session,
        post_id: str,
        payload: BlogUpdateRequest,
        actor_email: str,
        actor_role: str,
    ) -> BlogPost:
        BlogService._ensure_editor_or_admin(actor_role)
        post = BlogService.get_post_by_id(db, post_id, include_deleted=False)

        if payload.expected_version is not None and payload.expected_version != post.version:
            raise BlogConflictError("Version mismatch")

        if payload.slug is not None and payload.slug != post.slug:
            if post.status == BlogPostStatus.PUBLISHED.value and actor_role != "admin":
                raise BlogValidationError("Slug is immutable after publish unless actor is admin")

            slug_in_use = db.query(BlogPost).filter(BlogPost.slug == payload.slug, BlogPost.id != post.id).first()
            if slug_in_use is not None:
                raise BlogConflictError("Slug already exists")
            post.slug = payload.slug

        next_status = payload.status if payload.status is not None else post.status
        BlogService._ensure_transition_allowed(post.status, next_status, actor_role)

        if payload.title is not None:
            post.title = payload.title
        if payload.excerpt is not None:
            post.excerpt = payload.excerpt
        if payload.content_markdown is not None:
            post.content_markdown = payload.content_markdown
        if payload.content_json is not None:
            post.content_json = payload.content_json
        if payload.visibility is not None:
            post.visibility = payload.visibility
        if payload.seo_title is not None:
            post.seo_title = payload.seo_title
        if payload.seo_description is not None:
            post.seo_description = payload.seo_description
        if payload.canonical_url is not None:
            post.canonical_url = payload.canonical_url
        if payload.cover_image_url is not None:
            post.cover_image_url = payload.cover_image_url
        if payload.locale is not None:
            post.locale = payload.locale
        if payload.ai_summary is not None:
            post.ai_summary = payload.ai_summary
        if payload.ai_keywords_json is not None:
            post.ai_keywords_json = payload.ai_keywords_json

        if payload.status is not None:
            post.status = payload.status

        if payload.scheduled_at is not None:
            post.scheduled_at = payload.scheduled_at

        BlogService._assert_status_schedule_consistency(post.status, post.scheduled_at)

        if post.status != BlogPostStatus.SCHEDULED.value:
            post.scheduled_at = None

        if post.status == BlogPostStatus.PUBLISHED.value and post.published_at is None:
            post.published_at = BlogService._now()

        post.last_edited_by_email = actor_email
        post.version += 1

        db.commit()
        db.refresh(post)
        return post

    @staticmethod
    def soft_delete_post(db: Session, post_id: str, actor_email: str, actor_role: str) -> BlogPost:
        BlogService._ensure_editor_or_admin(actor_role)
        post = BlogService.get_post_by_id(db, post_id, include_deleted=False)

        post.deleted_at = BlogService._now()
        post.last_edited_by_email = actor_email
        post.version += 1

        db.commit()
        db.refresh(post)
        return post

    @staticmethod
    def publish_post(
        db: Session,
        post_id: str,
        payload: BlogPublishRequest,
        actor_email: str,
        actor_role: str,
    ) -> BlogPost:
        BlogService._ensure_editor_or_admin(actor_role)
        post = BlogService.get_post_by_id(db, post_id, include_deleted=False)

        if payload.schedule_at is not None:
            BlogService._ensure_transition_allowed(post.status, BlogPostStatus.SCHEDULED.value, actor_role)
            post.status = BlogPostStatus.SCHEDULED.value
            post.scheduled_at = payload.schedule_at
            post.published_at = None
        elif payload.publish_at is not None:
            BlogService._ensure_transition_allowed(post.status, BlogPostStatus.PUBLISHED.value, actor_role)
            post.status = BlogPostStatus.PUBLISHED.value
            post.published_at = payload.publish_at
            post.scheduled_at = None
        else:
            BlogService._ensure_transition_allowed(post.status, BlogPostStatus.PUBLISHED.value, actor_role)
            post.status = BlogPostStatus.PUBLISHED.value
            post.published_at = BlogService._now()
            post.scheduled_at = None

        BlogService._assert_status_schedule_consistency(post.status, post.scheduled_at)

        post.last_edited_by_email = actor_email
        post.version += 1

        db.commit()
        db.refresh(post)
        return post

    @staticmethod
    def archive_post(db: Session, post_id: str, actor_email: str, actor_role: str) -> BlogPost:
        BlogService._ensure_editor_or_admin(actor_role)
        post = BlogService.get_post_by_id(db, post_id, include_deleted=False)

        BlogService._ensure_transition_allowed(post.status, BlogPostStatus.ARCHIVED.value, actor_role)
        post.status = BlogPostStatus.ARCHIVED.value
        post.scheduled_at = None
        post.last_edited_by_email = actor_email
        post.version += 1

        db.commit()
        db.refresh(post)
        return post
