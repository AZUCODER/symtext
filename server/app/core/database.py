from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import get_settings
from app.core.models import Base

settings = get_settings()

# Create database engine
engine = create_engine(settings.database_url, pool_pre_ping=True)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Session:
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)

    # Cleanup legacy password column after migrating to passwordless auth.
    # Safe to run repeatedly because of IF EXISTS.
    if engine.dialect.name == "postgresql":
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS password"))
