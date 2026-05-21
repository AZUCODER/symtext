import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import StaticPool, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.api.router import api_router
from app.core.database import get_db
from app.core.models import Base, User
from app.core.security import create_access_token


class UserAdminApiTests(unittest.TestCase):
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
                User(email="admin@example.com", name="Admin", role="admin", is_verified=True),
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

    def test_admin_can_create_update_delete_user(self) -> None:
        create_response = self.client.post(
            "/api/v1/auth/users",
            headers=self._auth_header("admin@example.com"),
            json={
                "email": "new-user@example.com",
                "name": "New User",
                "role": "viewer",
                "is_verified": False,
                "send_verification": False,
            },
        )
        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(create_response.json()["email"], "new-user@example.com")

        update_response = self.client.patch(
            "/api/v1/auth/users/new-user@example.com",
            headers=self._auth_header("admin@example.com"),
            json={
                "name": "Renamed User",
                "role": "editor",
                "is_verified": True,
            },
        )
        self.assertEqual(update_response.status_code, 200)
        body = update_response.json()
        self.assertEqual(body["name"], "Renamed User")
        self.assertEqual(body["role"], "editor")
        self.assertTrue(body["is_verified"])

        delete_response = self.client.delete(
            "/api/v1/auth/users/new-user@example.com",
            headers=self._auth_header("admin@example.com"),
        )
        self.assertEqual(delete_response.status_code, 200)

        list_response = self.client.get(
            "/api/v1/auth/users",
            headers=self._auth_header("admin@example.com"),
        )
        emails = [user["email"] for user in list_response.json().get("users", [])]
        self.assertNotIn("new-user@example.com", emails)

    def test_viewer_cannot_create_user(self) -> None:
        response = self.client.post(
            "/api/v1/auth/users",
            headers=self._auth_header("viewer@example.com"),
            json={
                "email": "blocked@example.com",
                "name": "Blocked",
                "role": "viewer",
            },
        )
        self.assertEqual(response.status_code, 403)

    def test_create_user_with_verification_requires_email_provider_config(self) -> None:
        missing_email_settings = SimpleNamespace(
            resend_api_key=None,
            resend_from_email=None,
        )

        with patch("app.api.routes.auth.get_settings", return_value=missing_email_settings):
            response = self.client.post(
                "/api/v1/auth/users",
                headers=self._auth_header("admin@example.com"),
                json={
                    "email": "no-mail@example.com",
                    "name": "No Mail",
                    "role": "viewer",
                    "is_verified": False,
                    "send_verification": True,
                },
            )
        self.assertEqual(response.status_code, 400)

        list_response = self.client.get(
            "/api/v1/auth/users",
            headers=self._auth_header("admin@example.com"),
        )
        emails = [user["email"] for user in list_response.json().get("users", [])]
        self.assertNotIn("no-mail@example.com", emails)


if __name__ == "__main__":
    unittest.main()
