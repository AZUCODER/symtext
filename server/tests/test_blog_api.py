from datetime import UTC, datetime
import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import Session, sessionmaker

from app.api.router import api_router
from app.core.database import get_db
from app.core.models import Base, User
from app.core.security import create_access_token


class BlogApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.SessionLocal = sessionmaker(bind=self.engine, autocommit=False, autoflush=False)
        Base.metadata.create_all(bind=self.engine)

        self.db: Session = self.SessionLocal()
        self.db.add_all(
            [
                User(email="editor@example.com", name="Editor", role="editor", is_verified=True),
                User(email="viewer@example.com", name="Viewer", role="viewer", is_verified=True),
            ]
        )
        self.db.commit()

        app = FastAPI()
        app.include_router(api_router, prefix="/api/v1")

        def override_get_db():
            test_db = self.SessionLocal()
            try:
                yield test_db
            finally:
                test_db.close()

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    @staticmethod
    def _auth_header(email: str) -> dict[str, str]:
        token = create_access_token(email)
        return {"Authorization": f"Bearer {token}"}

    def test_viewer_cannot_create_blog_post(self) -> None:
        response = self.client.post(
            "/api/v1/blog",
            headers=self._auth_header("viewer@example.com"),
            json={
                "slug": "api-viewer-post",
                "title": "Viewer Post",
                "content_markdown": "content",
                "visibility": "public",
            },
        )

        self.assertEqual(response.status_code, 403)

    def test_public_can_only_read_after_publish(self) -> None:
        create_response = self.client.post(
            "/api/v1/blog",
            headers=self._auth_header("editor@example.com"),
            json={
                "slug": "api-public-post",
                "title": "Public Post",
                "content_markdown": "content",
                "visibility": "public",
            },
        )
        self.assertEqual(create_response.status_code, 201)
        post_id = create_response.json()["id"]

        anon_get_before_publish = self.client.get(f"/api/v1/blog/{post_id}")
        self.assertEqual(anon_get_before_publish.status_code, 404)

        publish_response = self.client.post(
            f"/api/v1/blog/{post_id}/publish",
            headers=self._auth_header("editor@example.com"),
            json={},
        )
        self.assertEqual(publish_response.status_code, 200)

        anon_get_after_publish = self.client.get(f"/api/v1/blog/{post_id}")
        self.assertEqual(anon_get_after_publish.status_code, 200)

        anon_get_by_slug = self.client.get("/api/v1/blog/slug/api-public-post")
        self.assertEqual(anon_get_by_slug.status_code, 200)

    def test_soft_delete_hides_public_post(self) -> None:
        create_response = self.client.post(
            "/api/v1/blog",
            headers=self._auth_header("editor@example.com"),
            json={
                "slug": "api-delete-post",
                "title": "Delete Post",
                "content_markdown": "content",
                "visibility": "public",
                "status": "published",
                "published_at": datetime.now(UTC).isoformat(),
            },
        )
        self.assertEqual(create_response.status_code, 201)
        post_id = create_response.json()["id"]

        delete_response = self.client.delete(
            f"/api/v1/blog/{post_id}",
            headers=self._auth_header("editor@example.com"),
        )
        self.assertEqual(delete_response.status_code, 200)

        anon_get = self.client.get(f"/api/v1/blog/{post_id}")
        self.assertEqual(anon_get.status_code, 404)


if __name__ == "__main__":
    unittest.main()
