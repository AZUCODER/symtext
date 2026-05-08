from functools import lru_cache
from pathlib import Path
from typing import Annotated
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(ENV_FILE), env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Symtext CMS API"
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"
    frontend_origins: Annotated[List[str], NoDecode] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30
    email_verification_expire_hours: int = 24
    resend_api_key: str = ""
    resend_from_email: str = ""
    app_base_url: str = "http://localhost:3000"
    database_url: str = "postgresql+psycopg://postgres:tony@localhost:5432/agentic-cms"

    @field_validator("frontend_origins", mode="before")
    @classmethod
    def split_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
