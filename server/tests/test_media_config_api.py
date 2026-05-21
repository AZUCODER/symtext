import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import StaticPool, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.api.router import api_router
from app.core.database import get_db
from app.core.models import Base, User
from app.core.security import create_access_token


class MediaConfigApiTests(unittest.TestCase):
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

    def test_admin_can_update_media_oss_config_with_masked_secret_response(self) -> None:
        response = self.client.put(
            "/api/v1/media/oss/config",
            headers=self._auth_header("admin@example.com"),
            json={
                "selected_provider": "aliyunoss",
                "endpoint": "oss-cn-chengdu.aliyuncs.com",
                "bucket_name": "symtext",
                "access_key_id": "LTAI-test-id",
                "access_key_secret": "test-secret-value",
                "public_base_url": "https://symtext.oss-cn-chengdu.aliyuncs.com",
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["selected_provider"], "aliyunoss")
        self.assertEqual(body["editable"]["endpoint"], "oss-cn-chengdu.aliyuncs.com")
        self.assertEqual(body["editable"]["bucket_name"], "symtext")
        self.assertEqual(body["editable"]["public_base_url"], "https://symtext.oss-cn-chengdu.aliyuncs.com")
        self.assertTrue(body["editable"]["has_access_key_id"])
        self.assertTrue(body["editable"]["has_access_key_secret"])
        self.assertEqual(body["editable"]["access_key_secret"], "")
        self.assertNotEqual(body["editable"]["access_key_id"], "LTAI-test-id")

    def test_updated_config_can_be_loaded_without_returning_raw_secret(self) -> None:
        update_response = self.client.put(
            "/api/v1/media/oss/config",
            headers=self._auth_header("admin@example.com"),
            json={
                "selected_provider": "aliyunoss",
                "endpoint": "oss-cn-chengdu.aliyuncs.com",
                "bucket_name": "symtext",
                "access_key_id": "LTAI-test-id",
                "access_key_secret": "test-secret-value",
                "public_base_url": "https://symtext.oss-cn-chengdu.aliyuncs.com",
            },
        )
        self.assertEqual(update_response.status_code, 200)

        get_response = self.client.get(
            "/api/v1/media/oss/config",
            headers=self._auth_header("admin@example.com"),
        )
        self.assertEqual(get_response.status_code, 200)

        body = get_response.json()
        self.assertEqual(body["editable"]["endpoint"], "oss-cn-chengdu.aliyuncs.com")
        self.assertEqual(body["editable"]["bucket_name"], "symtext")
        self.assertEqual(body["editable"]["public_base_url"], "https://symtext.oss-cn-chengdu.aliyuncs.com")
        self.assertEqual(body["editable"]["access_key_secret"], "")
        self.assertTrue(body["editable"]["has_access_key_id"])
        self.assertTrue(body["editable"]["has_access_key_secret"])

    def test_viewer_cannot_update_media_oss_config(self) -> None:
        response = self.client.put(
            "/api/v1/media/oss/config",
            headers=self._auth_header("viewer@example.com"),
            json={
                "selected_provider": "aliyunoss",
                "endpoint": "oss-cn-chengdu.aliyuncs.com",
                "bucket_name": "symtext",
                "public_base_url": "https://symtext.oss-cn-chengdu.aliyuncs.com",
            },
        )
        self.assertEqual(response.status_code, 403)


if __name__ == "__main__":
    unittest.main()
