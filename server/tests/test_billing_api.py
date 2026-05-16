import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import StaticPool, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.api.router import api_router
from app.core.database import get_db
from app.core.models import Base, User
from app.core.security import create_access_token


class BillingApiTests(unittest.TestCase):
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

    def test_admin_can_update_billing_config_with_masked_response(self) -> None:
        response = self.client.put(
            "/api/v1/billing/config",
            headers=self._auth_header("admin@example.com"),
            json={
                "selected_provider": "paypal",
                "mode": "sandbox",
                "enabled": True,
                "app_id": "paypal-app-id",
                "secret": "paypal-secret",
                "webhook_secret": "paypal-webhook-id",
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["selected_provider"], "paypal")
        self.assertTrue(payload["editable"]["has_app_id"])
        self.assertTrue(payload["editable"]["has_secret"])
        self.assertTrue(payload["editable"]["has_webhook_secret"])
        self.assertEqual(payload["editable"]["secret"], "")
        self.assertNotEqual(payload["editable"]["app_id"], "paypal-app-id")

    def test_viewer_cannot_access_billing_config(self) -> None:
        response = self.client.get(
            "/api/v1/billing/config",
            headers=self._auth_header("viewer@example.com"),
        )
        self.assertEqual(response.status_code, 403)

    @patch("app.services.billing_service._verify_paypal_webhook", return_value=True)
    def test_paypal_webhook_is_idempotent(self, _: object) -> None:
        setup_response = self.client.put(
            "/api/v1/billing/config",
            headers=self._auth_header("admin@example.com"),
            json={
                "selected_provider": "paypal",
                "mode": "sandbox",
                "enabled": True,
                "app_id": "paypal-app-id",
                "secret": "paypal-secret",
                "webhook_secret": "paypal-webhook-id",
            },
        )
        self.assertEqual(setup_response.status_code, 200)

        headers = {
            "PayPal-Auth-Algo": "SHA256withRSA",
            "PayPal-Cert-Url": "https://api-m.sandbox.paypal.com/certs/cert.pem",
            "PayPal-Transmission-Id": "tx-123",
            "PayPal-Transmission-Sig": "sig-abc",
            "PayPal-Transmission-Time": "2026-05-16T12:00:00Z",
        }
        body = {
            "id": "WH-TEST-1",
            "event_type": "PAYMENT.CAPTURE.COMPLETED",
            "resource": {
                "id": "CAPTURE-1",
                "status": "COMPLETED",
                "payer": {"email_address": "payer@example.com"},
                "amount": {"currency_code": "USD", "value": "10.00"},
            },
        }

        first = self.client.post("/api/v1/billing/webhooks/paypal", headers=headers, json=body)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.json()["duplicate"], False)

        second = self.client.post("/api/v1/billing/webhooks/paypal", headers=headers, json=body)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(second.json()["duplicate"], True)

        transactions_response = self.client.get(
            "/api/v1/billing/transactions",
            headers=self._auth_header("admin@example.com"),
        )
        self.assertEqual(transactions_response.status_code, 200)
        self.assertEqual(transactions_response.json()["total"], 1)


if __name__ == "__main__":
    unittest.main()
