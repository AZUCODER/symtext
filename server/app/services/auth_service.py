from datetime import UTC, datetime

from sqlalchemy.orm import Session
from app.core.models import EmailChallenge, RefreshToken, User


class UserService:
    @staticmethod
    def get_user(db: Session, email: str) -> User | None:
        return db.query(User).filter(User.email == email.lower()).first()

    @staticmethod
    def create_user(db: Session, email: str, name: str | None = None) -> User:
        email_lower = email.lower()
        inferred_name = (name or email_lower.split("@", 1)[0]).strip() or email_lower
        user = User(
            email=email_lower,
            name=inferred_name,
            role="admin" if db.query(User).count() == 0 else "viewer",
            is_verified=False,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def user_exists(db: Session, email: str) -> bool:
        return db.query(User).filter(User.email == email.lower()).first() is not None

    @staticmethod
    def verify_user(db: Session, email: str) -> None:
        user = db.query(User).filter(User.email == email.lower()).first()
        if user:
            user.is_verified = True
            db.commit()

    @staticmethod
    def get_all_users(db: Session) -> list[User]:
        return db.query(User).all()

    @staticmethod
    def update_user_role(db: Session, email: str, new_role: str) -> User:
        user = db.query(User).filter(User.email == email.lower()).first()
        if user:
            user.role = new_role
            db.commit()
            db.refresh(user)
        return user


class RefreshTokenService:
    @staticmethod
    def store_refresh_token(db: Session, email: str, token_hash: str) -> None:
        email_lower = email.lower()
        # Try to update existing token
        existing = db.query(RefreshToken).filter(RefreshToken.email == email_lower).first()
        if existing:
            existing.token_hash = token_hash
        else:
            token = RefreshToken(email=email_lower, token_hash=token_hash)
            db.add(token)
        db.commit()

    @staticmethod
    def verify_refresh_token(db: Session, email: str, token_hash: str) -> bool:
        token = db.query(RefreshToken).filter(RefreshToken.email == email.lower()).first()
        return token is not None and token.token_hash == token_hash

    @staticmethod
    def remove_refresh_token(db: Session, email: str) -> None:
        db.query(RefreshToken).filter(RefreshToken.email == email.lower()).delete()
        db.commit()


class EmailChallengeService:
    @staticmethod
    def _normalize_utc(value: datetime) -> datetime:
        # Some DB drivers return naive datetimes even when values originated as UTC.
        # Normalize to UTC-aware before temporal comparisons.
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)

    @staticmethod
    def store_challenge(
        db: Session,
        email: str,
        token_hash: str,
        purpose: str,
        expires_at: datetime,
        redirect_path: str | None = None,
    ) -> None:
        email_lower = email.lower()

        existing = (
            db.query(EmailChallenge)
            .filter(EmailChallenge.email == email_lower)
            .filter(EmailChallenge.purpose == purpose)
            .filter(EmailChallenge.consumed_at.is_(None))
            .first()
        )
        if existing:
            db.delete(existing)

        challenge = EmailChallenge(
            email=email_lower,
            token_hash=token_hash,
            purpose=purpose,
            redirect_path=redirect_path,
            expires_at=expires_at,
        )
        db.add(challenge)
        db.commit()

    @staticmethod
    def consume_challenge(db: Session, token_hash: str, purpose: str) -> tuple[str, str | None] | None:
        challenge = (
            db.query(EmailChallenge)
            .filter(EmailChallenge.token_hash == token_hash)
            .filter(EmailChallenge.purpose == purpose)
            .first()
        )
        if challenge is None:
            return None

        now = datetime.now(UTC)
        expires_at = EmailChallengeService._normalize_utc(challenge.expires_at)
        if challenge.consumed_at is not None or expires_at < now:
            return None

        challenge.consumed_at = now
        db.commit()
        return challenge.email, challenge.redirect_path

    @staticmethod
    def clear_challenges_for_email(db: Session, email: str) -> None:
        db.query(EmailChallenge).filter(EmailChallenge.email == email.lower()).delete()
        db.commit()
