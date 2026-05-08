from datetime import UTC, datetime, timedelta
import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.models import Base, EmailChallenge
from app.services.auth_service import EmailChallengeService


class EmailChallengeServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine, autocommit=False, autoflush=False)
        self.db = self.SessionLocal()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def test_normalize_utc_handles_naive_and_aware(self) -> None:
        naive = datetime.now()
        aware = datetime.now(UTC)

        normalized_naive = EmailChallengeService._normalize_utc(naive)
        normalized_aware = EmailChallengeService._normalize_utc(aware)

        self.assertIsNotNone(normalized_naive.tzinfo)
        self.assertIsNotNone(normalized_aware.tzinfo)

    def test_consume_challenge_accepts_naive_future_expiry(self) -> None:
        challenge = EmailChallenge(
            token_hash="token-naive-future",
            email="user@example.com",
            purpose="login",
            expires_at=datetime.now() + timedelta(minutes=15),
            redirect_path="/dashboard",
        )
        self.db.add(challenge)
        self.db.commit()

        consumed = EmailChallengeService.consume_challenge(
            db=self.db,
            token_hash="token-naive-future",
            purpose="login",
        )

        self.assertEqual(consumed, ("user@example.com", "/dashboard"))

    def test_consume_challenge_rejects_reuse(self) -> None:
        challenge = EmailChallenge(
            token_hash="token-single-use",
            email="user@example.com",
            purpose="register",
            expires_at=datetime.now(UTC) + timedelta(minutes=15),
            redirect_path=None,
        )
        self.db.add(challenge)
        self.db.commit()

        first = EmailChallengeService.consume_challenge(
            db=self.db,
            token_hash="token-single-use",
            purpose="register",
        )
        second = EmailChallengeService.consume_challenge(
            db=self.db,
            token_hash="token-single-use",
            purpose="register",
        )

        self.assertEqual(first, ("user@example.com", None))
        self.assertIsNone(second)

    def test_consume_challenge_rejects_expired(self) -> None:
        challenge = EmailChallenge(
            token_hash="token-expired",
            email="user@example.com",
            purpose="login",
            expires_at=datetime.now(UTC) - timedelta(minutes=1),
            redirect_path="/dashboard",
        )
        self.db.add(challenge)
        self.db.commit()

        consumed = EmailChallengeService.consume_challenge(
            db=self.db,
            token_hash="token-expired",
            purpose="login",
        )

        self.assertIsNone(consumed)


if __name__ == "__main__":
    unittest.main()
