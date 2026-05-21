from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_optional_current_user, require_roles
from app.core.database import get_db
from app.core.models import BlogPost
from app.schemas.auth import UserProfile
from app.schemas.blog import (
    BlogCreateRequest,
    BlogListResponse,
    BlogPublishRequest,
    BlogResponse,
    BlogUpdateRequest,
)
from app.services.blog_service import (
    BlogConflictError,
    BlogNotFoundError,
    BlogPermissionDenied,
    BlogService,
    BlogValidationError,
)

router = APIRouter(prefix="/blog", tags=["blog"])


def to_blog_response(post: BlogPost) -> BlogResponse:
    return BlogResponse(
        id=post.id,
        slug=post.slug,
        title=post.title,
        excerpt=post.excerpt,
        content_markdown=post.content_markdown,
        content_json=post.content_json,
        status=post.status,
        visibility=post.visibility,
        seo_title=post.seo_title,
        seo_description=post.seo_description,
        canonical_url=post.canonical_url,
        cover_image_url=post.cover_image_url,
        locale=post.locale,
        author_email=post.author_email,
        last_edited_by_email=post.last_edited_by_email,
        published_at=post.published_at,
        scheduled_at=post.scheduled_at,
        version=post.version,
        ai_summary=post.ai_summary,
        ai_keywords_json=post.ai_keywords_json,
        created_at=post.created_at,
        updated_at=post.updated_at,
        deleted_at=post.deleted_at,
    )


def _is_editor_or_admin(user: UserProfile | None) -> bool:
    return user is not None and user.role in {"editor", "admin"}


def _handle_service_error(error: Exception) -> None:
    if isinstance(error, BlogNotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))
    if isinstance(error, BlogPermissionDenied):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error))
    if isinstance(error, BlogConflictError):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))
    if isinstance(error, BlogValidationError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error))
    raise error


@router.post("", response_model=BlogResponse, status_code=status.HTTP_201_CREATED)
def create_blog_post(
    payload: BlogCreateRequest,
    db: Session = Depends(get_db),
    current_user: UserProfile = Depends(require_roles({"editor", "admin"})),
) -> BlogResponse:
    try:
        post = BlogService.create_post(
            db,
            payload,
            actor_email=current_user.email,
            actor_role=current_user.role,
        )
        return to_blog_response(post)
    except Exception as error:  # pragma: no cover - defensive mapper
        _handle_service_error(error)


@router.get("/{post_id}", response_model=BlogResponse)
def get_blog_post_by_id(
    post_id: str,
    db: Session = Depends(get_db),
    current_user: UserProfile | None = Depends(get_optional_current_user),
) -> BlogResponse:
    try:
        post = BlogService.get_post_by_id(
            db,
            post_id,
            include_deleted=_is_editor_or_admin(current_user),
            public_only=not _is_editor_or_admin(current_user),
        )
        return to_blog_response(post)
    except Exception as error:  # pragma: no cover - defensive mapper
        _handle_service_error(error)


@router.get("/slug/{slug}", response_model=BlogResponse)
def get_blog_post_by_slug(
    slug: str,
    db: Session = Depends(get_db),
    current_user: UserProfile | None = Depends(get_optional_current_user),
) -> BlogResponse:
    try:
        post = BlogService.get_post_by_slug(
            db,
            slug,
            include_deleted=_is_editor_or_admin(current_user),
            public_only=not _is_editor_or_admin(current_user),
        )
        return to_blog_response(post)
    except Exception as error:  # pragma: no cover - defensive mapper
        _handle_service_error(error)


@router.get("", response_model=BlogListResponse)
def list_blog_posts(
    db: Session = Depends(get_db),
    current_user: UserProfile | None = Depends(get_optional_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: str | None = Query(default=None, alias="status"),
    author_email: str | None = Query(default=None),
    locale: str | None = Query(default=None),
    visibility: str | None = Query(default=None),
    include_deleted: bool = Query(default=False),
) -> BlogListResponse:
    try:
        can_view_internal = _is_editor_or_admin(current_user)
        items, total = BlogService.list_posts(
            db,
            page=page,
            page_size=page_size,
            actor_role=current_user.role if current_user is not None else None,
            status=status_filter,
            author_email=author_email,
            locale=locale,
            visibility=visibility,
            include_deleted=include_deleted and can_view_internal,
            public_only=not can_view_internal,
        )
        return BlogListResponse(
            items=[to_blog_response(item) for item in items],
            page=page,
            page_size=page_size,
            total=total,
        )
    except Exception as error:  # pragma: no cover - defensive mapper
        _handle_service_error(error)


@router.patch("/{post_id}", response_model=BlogResponse)
def update_blog_post(
    post_id: str,
    payload: BlogUpdateRequest,
    db: Session = Depends(get_db),
    current_user: UserProfile = Depends(require_roles({"editor", "admin"})),
) -> BlogResponse:
    try:
        post = BlogService.update_post(
            db,
            post_id,
            payload,
            actor_email=current_user.email,
            actor_role=current_user.role,
        )
        return to_blog_response(post)
    except Exception as error:  # pragma: no cover - defensive mapper
        _handle_service_error(error)


@router.post("/{post_id}/publish", response_model=BlogResponse)
def publish_blog_post(
    post_id: str,
    payload: BlogPublishRequest,
    db: Session = Depends(get_db),
    current_user: UserProfile = Depends(require_roles({"editor", "admin"})),
) -> BlogResponse:
    try:
        post = BlogService.publish_post(
            db,
            post_id,
            payload,
            actor_email=current_user.email,
            actor_role=current_user.role,
        )
        return to_blog_response(post)
    except Exception as error:  # pragma: no cover - defensive mapper
        _handle_service_error(error)


@router.post("/{post_id}/archive", response_model=BlogResponse)
def archive_blog_post(
    post_id: str,
    db: Session = Depends(get_db),
    current_user: UserProfile = Depends(require_roles({"editor", "admin"})),
) -> BlogResponse:
    try:
        post = BlogService.archive_post(
            db,
            post_id,
            actor_email=current_user.email,
            actor_role=current_user.role,
        )
        return to_blog_response(post)
    except Exception as error:  # pragma: no cover - defensive mapper
        _handle_service_error(error)


@router.delete("/{post_id}", response_model=BlogResponse)
def delete_blog_post(
    post_id: str,
    db: Session = Depends(get_db),
    current_user: UserProfile = Depends(require_roles({"editor", "admin"})),
) -> BlogResponse:
    try:
        post = BlogService.soft_delete_post(
            db,
            post_id,
            actor_email=current_user.email,
            actor_role=current_user.role,
        )
        return to_blog_response(post)
    except Exception as error:  # pragma: no cover - defensive mapper
        _handle_service_error(error)
