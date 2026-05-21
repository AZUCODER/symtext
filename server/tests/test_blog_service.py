from datetime import UTC, datetime, timedelta
import unittest

from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.models import Base, User
from app.schemas.blog import BlogCreateRequest, BlogPublishRequest, BlogUpdateRequest
from app.services.blog_service import BlogPermissionDenied, BlogService, BlogValidationError


class BlogServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine, autocommit=False, autoflush=False)
        self.db = self.SessionLocal()

        self.db.add_all(
            [
                User(email="editor@example.com", name="Editor", role="editor", is_verified=True),
                User(email="admin@example.com", name="Admin", role="admin", is_verified=True),
                User(email="viewer@example.com", name="Viewer", role="viewer", is_verified=True),
            ]
        )
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def _create_payload(self, *, status: str = "draft") -> BlogCreateRequest:
        return BlogCreateRequest(
            slug=f"test-post-{int(datetime.now(UTC).timestamp() * 1000)}",
            title="Test Post",
            excerpt="Short summary",
            content_markdown="# Heading\n\nBody",
            status=status,
            visibility="public",
        )

    def test_role_boundary_viewer_cannot_create(self) -> None:
        payload = self._create_payload()
        with self.assertRaises(BlogPermissionDenied):
            BlogService.create_post(
                self.db,
                payload,
                actor_email="viewer@example.com",
                actor_role="viewer",
            )

    def test_status_transition_archived_to_draft_blocked_for_editor(self) -> None:
        post = BlogService.create_post(
            self.db,
            self._create_payload(),
            actor_email="editor@example.com",
            actor_role="editor",
        )

        BlogService.archive_post(
            self.db,
            post.id,
            actor_email="editor@example.com",
            actor_role="editor",
        )

        with self.assertRaises(BlogValidationError):
            BlogService.update_post(
                self.db,
                post.id,
                BlogUpdateRequest(status="draft"),
                actor_email="editor@example.com",
                actor_role="editor",
            )

    def test_scheduling_validation_requires_future_datetime(self) -> None:
        post = BlogService.create_post(
            self.db,
            self._create_payload(),
            actor_email="editor@example.com",
            actor_role="editor",
        )

        # Pydantic rejects past schedule_at at the schema level
        with self.assertRaises(ValidationError):
            BlogPublishRequest(schedule_at=datetime.now(UTC) - timedelta(minutes=5))

    def test_soft_delete_excludes_public_listing(self) -> None:
        post = BlogService.create_post(
            self.db,
            self._create_payload(),
            actor_email="editor@example.com",
            actor_role="editor",
        )

        BlogService.publish_post(
            self.db,
            post.id,
            BlogPublishRequest(),
            actor_email="editor@example.com",
            actor_role="editor",
        )

        public_items_before, public_total_before = BlogService.list_posts(
            self.db,
            page=1,
            page_size=20,
            actor_role=None,
            public_only=True,
        )
        self.assertEqual(public_total_before, 1)
        self.assertEqual(len(public_items_before), 1)

        BlogService.soft_delete_post(
            self.db,
            post.id,
            actor_email="editor@example.com",
            actor_role="editor",
        )

        public_items_after, public_total_after = BlogService.list_posts(
            self.db,
            page=1,
            page_size=20,
            actor_role=None,
            public_only=True,
        )
        self.assertEqual(public_total_after, 0)
        self.assertEqual(len(public_items_after), 0)

        editor_items_without_deleted, _ = BlogService.list_posts(
            self.db,
            page=1,
            page_size=20,
            actor_role="editor",
            include_deleted=False,
        )
        self.assertEqual(len(editor_items_without_deleted), 0)

        editor_items_with_deleted, _ = BlogService.list_posts(
            self.db,
            page=1,
            page_size=20,
            actor_role="editor",
            include_deleted=True,
        )
        self.assertEqual(len(editor_items_with_deleted), 1)

    def test_slug_is_immutable_for_editor_after_publish(self) -> None:
        post = BlogService.create_post(
            self.db,
            BlogCreateRequest(
                slug="immutable-slug",
                title="Immutable Slug",
                content_markdown="content",
                status="published",
                published_at=datetime.now(UTC),
                visibility="public",
            ),
            actor_email="editor@example.com",
            actor_role="editor",
        )

        with self.assertRaises(BlogValidationError):
            BlogService.update_post(
                self.db,
                post.id,
                BlogUpdateRequest(slug="new-slug"),
                actor_email="editor@example.com",
                actor_role="editor",
            )


if __name__ == "__main__":
    unittest.main()
