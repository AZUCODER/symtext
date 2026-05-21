import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import StaticPool, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.api.router import api_router
from app.core.database import get_db
from app.core.models import Base, User
from app.core.security import create_access_token


class AiConfigApiTests(unittest.TestCase):
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

    def test_admin_can_update_ai_config_with_masked_secret(self) -> None:
        response = self.client.put(
            "/api/v1/ai/config",
            headers=self._auth_header("admin@example.com"),
            json={
                "selected_provider": "openai_compatible",
                "model": "gpt-4o-mini",
                "temperature": 0.2,
                "max_tokens": 2048,
                "system_prompt": "custom prompt",
                "api_key": "test-api-key",
                "base_url": "https://example.ai/v1",
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["selected_provider"], "openai_compatible")
        self.assertEqual(body["editable"]["base_url"], "https://example.ai/v1")
        self.assertTrue(body["editable"]["has_api_key"])
        self.assertNotEqual(body["editable"]["api_key"], "test-api-key")

    def test_viewer_can_get_but_cannot_update_ai_config(self) -> None:
        get_response = self.client.get(
            "/api/v1/ai/config",
            headers=self._auth_header("viewer@example.com"),
        )
        self.assertEqual(get_response.status_code, 200)

        update_response = self.client.put(
            "/api/v1/ai/config",
            headers=self._auth_header("viewer@example.com"),
            json={
                "selected_provider": "deepseek",
                "model": "deepseek-chat",
                "temperature": 0.2,
                "max_tokens": 2048,
                "system_prompt": None,
            },
        )
        self.assertEqual(update_response.status_code, 403)

    def test_editor_can_get_runtime_config_with_active_provider(self) -> None:
        update_response = self.client.put(
            "/api/v1/ai/config",
            headers=self._auth_header("admin@example.com"),
            json={
                "selected_provider": "openai_compatible",
                "model": "gpt-4o-mini",
                "temperature": 0.2,
                "max_tokens": 2048,
                "system_prompt": "custom prompt",
                "api_key": "test-api-key",
                "base_url": "https://example.ai/v1",
            },
        )
        self.assertEqual(update_response.status_code, 200)

        runtime_response = self.client.get(
            "/api/v1/ai/runtime-config",
            headers=self._auth_header("editor@example.com"),
        )
        self.assertEqual(runtime_response.status_code, 200)

        body = runtime_response.json()
        self.assertEqual(body["selected_provider"], "openai_compatible")
        self.assertEqual(body["active_provider"], "openai_compatible")
        self.assertFalse(body["fallback_applied"])
        self.assertEqual(body["runtime"]["provider"], "openai_compatible")
        self.assertEqual(body["runtime"]["api_key"], "test-api-key")
        self.assertEqual(body["runtime"]["base_url"], "https://example.ai/v1")

    def test_viewer_cannot_get_runtime_config(self) -> None:
        runtime_response = self.client.get(
            "/api/v1/ai/runtime-config",
            headers=self._auth_header("viewer@example.com"),
        )
        self.assertEqual(runtime_response.status_code, 403)


if __name__ == "__main__":
    unittest.main()
