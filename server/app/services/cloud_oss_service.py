import base64
import hashlib
from dataclasses import dataclass

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.models import AppSetting
from app.schemas.media import (
    CloudOssConfigResponse,
    CloudOssConfigUpdateRequest,
    CloudOssEditableFields,
    CloudOssProvider,
    CloudOssProviderStatus,
)
from app.services.oss_config import resolve_aliyun_bucket_name


SUPPORTED_PROVIDERS: tuple[CloudOssProvider, ...] = ("aliyunoss", "huaweioss", "awsoss")
SIGNED_UPLOAD_PROVIDERS: set[CloudOssProvider] = {"aliyunoss"}
SELECTED_PROVIDER_KEY = "cloud_oss.selected_provider"


@dataclass(frozen=True)
class CloudOssRuntimeConfig:
    endpoint: str
    bucket_name: str
    access_key_id: str
    access_key_secret: str
    public_base_url: str


def _setting_key(provider: CloudOssProvider, field: str) -> str:
    return f"cloud_oss.{provider}.{field}"


def _fernet(settings: Settings) -> Fernet:
    configured_key = settings.oss_config_encryption_key.strip()
    if configured_key:
        return Fernet(configured_key.encode("utf-8"))

    digest = hashlib.sha256(settings.jwt_secret_key.encode("utf-8")).digest()
    derived_key = base64.urlsafe_b64encode(digest)
    return Fernet(derived_key)


def _upsert_setting(db: Session, *, key: str, value: str, is_secret: bool) -> None:
    item = db.get(AppSetting, key)
    if item is None:
        db.add(AppSetting(key=key, value=value, is_secret=is_secret))
        return

    item.value = value
    item.is_secret = is_secret


def _get_setting(db: Session, key: str) -> AppSetting | None:
    return db.get(AppSetting, key)


def _encrypt_secret(settings: Settings, value: str) -> str:
    token = _fernet(settings).encrypt(value.encode("utf-8"))
    return token.decode("utf-8")


def _decrypt_secret(settings: Settings, value: str) -> str:
    try:
        return _fernet(settings).decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return ""


def _provider_env_defaults(settings: Settings, provider: CloudOssProvider) -> CloudOssRuntimeConfig:
    if provider == "aliyunoss":
        bucket_name = (resolve_aliyun_bucket_name(settings) or "").strip()
        return CloudOssRuntimeConfig(
            endpoint=settings.oss_endpoint.strip(),
            bucket_name=bucket_name,
            access_key_id=settings.oss_access_key_id.strip(),
            access_key_secret=settings.oss_access_key_secret.strip(),
            public_base_url=settings.oss_public_base_url.strip(),
        )

    if provider == "huaweioss":
        return CloudOssRuntimeConfig(
            endpoint=settings.huawei_oss_endpoint.strip(),
            bucket_name=settings.huawei_oss_bucket_name.strip(),
            access_key_id=settings.huawei_oss_access_key_id.strip(),
            access_key_secret=settings.huawei_oss_access_key_secret.strip(),
            public_base_url=settings.huawei_oss_public_base_url.strip(),
        )

    return CloudOssRuntimeConfig(
        endpoint=settings.aws_oss_region.strip(),
        bucket_name=settings.aws_oss_bucket_name.strip(),
        access_key_id=settings.aws_oss_access_key_id.strip(),
        access_key_secret=settings.aws_oss_access_key_secret.strip(),
        public_base_url=settings.aws_oss_public_base_url.strip(),
    )


def get_provider_runtime_config(db: Session, settings: Settings, provider: CloudOssProvider) -> CloudOssRuntimeConfig:
    fallback = _provider_env_defaults(settings, provider)

    endpoint_setting = _get_setting(db, _setting_key(provider, "endpoint"))
    bucket_setting = _get_setting(db, _setting_key(provider, "bucket_name"))
    base_url_setting = _get_setting(db, _setting_key(provider, "public_base_url"))
    key_id_setting = _get_setting(db, _setting_key(provider, "access_key_id"))
    key_secret_setting = _get_setting(db, _setting_key(provider, "access_key_secret"))

    endpoint = endpoint_setting.value if endpoint_setting is not None else fallback.endpoint
    bucket_name = bucket_setting.value if bucket_setting is not None else fallback.bucket_name
    public_base_url = base_url_setting.value if base_url_setting is not None else fallback.public_base_url

    access_key_id = (
        _decrypt_secret(settings, key_id_setting.value) if key_id_setting is not None else fallback.access_key_id
    )
    access_key_secret = (
        _decrypt_secret(settings, key_secret_setting.value)
        if key_secret_setting is not None
        else fallback.access_key_secret
    )

    return CloudOssRuntimeConfig(
        endpoint=endpoint.strip(),
        bucket_name=bucket_name.strip(),
        access_key_id=access_key_id.strip(),
        access_key_secret=access_key_secret.strip(),
        public_base_url=public_base_url.strip(),
    )


def _is_provider_configured(config: CloudOssRuntimeConfig) -> bool:
    return all([config.endpoint, config.bucket_name, config.access_key_id, config.access_key_secret])


def provider_statuses(db: Session, settings: Settings) -> list[CloudOssProviderStatus]:
    return [
        CloudOssProviderStatus(
            provider=provider,
            configured=_is_provider_configured(get_provider_runtime_config(db, settings, provider)),
            supports_signed_upload=provider in SIGNED_UPLOAD_PROVIDERS,
        )
        for provider in SUPPORTED_PROVIDERS
    ]


def get_selected_provider(db: Session, settings: Settings) -> CloudOssProvider:
    persisted = _get_setting(db, SELECTED_PROVIDER_KEY)
    if persisted and persisted.value in SUPPORTED_PROVIDERS:
        return persisted.value  # type: ignore[return-value]

    statuses = provider_statuses(db, settings)
    configured = [item.provider for item in statuses if item.configured]
    selected_provider = configured[0] if configured else "aliyunoss"
    _upsert_setting(db, key=SELECTED_PROVIDER_KEY, value=selected_provider, is_secret=False)
    db.commit()
    return selected_provider


def _mask_secret(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 4:
        return "*" * len(value)
    return f"{'*' * (len(value) - 4)}{value[-4:]}"


def get_cloud_oss_config(db: Session, settings: Settings) -> CloudOssConfigResponse:
    selected_provider = get_selected_provider(db, settings)
    runtime_config = get_provider_runtime_config(db, settings, selected_provider)
    return CloudOssConfigResponse(
        selected_provider=selected_provider,
        providers=provider_statuses(db, settings),
        editable=CloudOssEditableFields(
            endpoint=runtime_config.endpoint,
            bucket_name=runtime_config.bucket_name,
            public_base_url=runtime_config.public_base_url,
            access_key_id=_mask_secret(runtime_config.access_key_id),
            access_key_secret="",
            has_access_key_id=bool(runtime_config.access_key_id),
            has_access_key_secret=bool(runtime_config.access_key_secret),
        ),
    )


def update_cloud_oss_config(db: Session, settings: Settings, payload: CloudOssConfigUpdateRequest) -> CloudOssConfigResponse:
    _upsert_setting(db, key=SELECTED_PROVIDER_KEY, value=payload.selected_provider, is_secret=False)
    _upsert_setting(db, key=_setting_key(payload.selected_provider, "endpoint"), value=payload.endpoint, is_secret=False)
    _upsert_setting(
        db,
        key=_setting_key(payload.selected_provider, "bucket_name"),
        value=payload.bucket_name,
        is_secret=False,
    )
    _upsert_setting(
        db,
        key=_setting_key(payload.selected_provider, "public_base_url"),
        value=payload.public_base_url,
        is_secret=False,
    )

    if payload.access_key_id is not None:
        _upsert_setting(
            db,
            key=_setting_key(payload.selected_provider, "access_key_id"),
            value=_encrypt_secret(settings, payload.access_key_id.strip()),
            is_secret=True,
        )

    if payload.access_key_secret is not None:
        _upsert_setting(
            db,
            key=_setting_key(payload.selected_provider, "access_key_secret"),
            value=_encrypt_secret(settings, payload.access_key_secret.strip()),
            is_secret=True,
        )

    db.commit()
    return get_cloud_oss_config(db, settings)
