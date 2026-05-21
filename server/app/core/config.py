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
    oss_endpoint: str = ""
    oss_bucket_name: str = ""
    oss_access_key_id: str = ""
    oss_access_key_secret: str = ""
    oss_public_base_url: str = ""
    oss_upload_dir: str = "uploads"
    oss_signed_url_expires_seconds: int = 600
    oss_max_upload_bytes: int = 104857600
    huawei_oss_endpoint: str = ""
    huawei_oss_bucket_name: str = ""
    huawei_oss_access_key_id: str = ""
    huawei_oss_access_key_secret: str = ""
    huawei_oss_public_base_url: str = ""
    aws_oss_region: str = ""
    aws_oss_bucket_name: str = ""
    aws_oss_access_key_id: str = ""
    aws_oss_access_key_secret: str = ""
    aws_oss_public_base_url: str = ""
    oss_config_encryption_key: str = ""
    deepseek_api_key: str = ""
    openai_api_key: str = ""
    groq_api_key: str = ""
    openai_compatible_api_key: str = ""
    openai_compatible_base_url: str = ""
    celery_broker_url: str = "redis://127.0.0.1:6379/0"
    celery_result_backend: str = "redis://127.0.0.1:6379/1"
    celery_task_default_queue: str = "symtext-agent-tasks"

    @field_validator("frontend_origins", mode="before")
    @classmethod
    def split_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
