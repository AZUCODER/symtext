import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.models import AppSetting
from app.schemas.ai import (
    AiLlmConfigResponse,
    AiLlmProviderRuntime,
    AiLlmRuntimeConfigResponse,
    AiLlmConfigUpdateRequest,
    AiLlmEditableFields,
    AiLlmProvider,
    AiLlmProviderStatus,
)

SUPPORTED_AI_PROVIDERS: tuple[AiLlmProvider, ...] = (
    "deepseek",
    "openai",
    "groq",
    "openai_compatible",
)

_DEFAULT_MODEL_BY_PROVIDER: dict[AiLlmProvider, str] = {
    "deepseek": "deepseek-chat",
    "openai": "gpt-4.1-mini",
    "groq": "llama-3.3-70b-versatile",
    "openai_compatible": "gpt-4o-mini",
}

_DEFAULT_BASE_URL_BY_PROVIDER: dict[AiLlmProvider, str] = {
    "deepseek": "https://api.deepseek.com/v1",
    "openai": "https://api.openai.com/v1",
    "groq": "https://api.groq.com/openai/v1",
    "openai_compatible": "",
}

SELECTED_PROVIDER_KEY = "ai_llm.selected_provider"
MODEL_KEY = "ai_llm.model"
TEMPERATURE_KEY = "ai_llm.temperature"
MAX_TOKENS_KEY = "ai_llm.max_tokens"
SYSTEM_PROMPT_KEY = "ai_llm.system_prompt"


def _provider_key(provider: AiLlmProvider, field: str) -> str:
    return f"ai_llm.{provider}.{field}"


def _setting(db: Session, key: str) -> AppSetting | None:
    return db.get(AppSetting, key)


def _upsert_setting(db: Session, *, key: str, value: str, is_secret: bool) -> None:
    item = _setting(db, key)
    if item is None:
        db.add(AppSetting(key=key, value=value, is_secret=is_secret))
        return
    item.value = value
    item.is_secret = is_secret


def _fernet(settings: Settings) -> Fernet:
    configured_key = settings.oss_config_encryption_key.strip()
    if configured_key:
        return Fernet(configured_key.encode("utf-8"))

    digest = hashlib.sha256(settings.jwt_secret_key.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def _encrypt_secret(settings: Settings, value: str) -> str:
    token = _fernet(settings).encrypt(value.encode("utf-8"))
    return token.decode("utf-8")


def _decrypt_secret(settings: Settings, value: str) -> str:
    try:
        return _fernet(settings).decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return ""


def _mask_secret(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 4:
        return "*" * len(value)
    return f"{'*' * (len(value) - 4)}{value[-4:]}"


def _provider_env_api_key(settings: Settings, provider: AiLlmProvider) -> str:
    if provider == "deepseek":
        return settings.deepseek_api_key.strip()
    if provider == "openai":
        return settings.openai_api_key.strip()
    if provider == "groq":
        return settings.groq_api_key.strip()
    return settings.openai_compatible_api_key.strip()


def _provider_env_base_url(settings: Settings, provider: AiLlmProvider) -> str:
    if provider == "deepseek":
        return _DEFAULT_BASE_URL_BY_PROVIDER[provider]
    if provider == "openai":
        return _DEFAULT_BASE_URL_BY_PROVIDER[provider]
    if provider == "groq":
        return _DEFAULT_BASE_URL_BY_PROVIDER[provider]
    return settings.openai_compatible_base_url.strip()


def get_provider_runtime_credentials(
    db: Session,
    settings: Settings,
    provider: AiLlmProvider,
) -> tuple[str, str]:
    api_key_setting = _setting(db, _provider_key(provider, "api_key"))
    base_url_setting = _setting(db, _provider_key(provider, "base_url"))

    api_key = (
        _decrypt_secret(settings, api_key_setting.value)
        if api_key_setting is not None
        else _provider_env_api_key(settings, provider)
    ).strip()

    base_url = (
        base_url_setting.value if base_url_setting is not None else _provider_env_base_url(settings, provider)
    ).strip()

    return api_key, base_url


def _is_provider_configured(db: Session, settings: Settings, provider: AiLlmProvider) -> bool:
    api_key, base_url = get_provider_runtime_credentials(db, settings, provider)
    if provider == "openai_compatible":
        return bool(api_key and base_url)
    return bool(api_key)


def provider_statuses(db: Session, settings: Settings) -> list[AiLlmProviderStatus]:
    return [
        AiLlmProviderStatus(
            provider=provider,
            configured=_is_provider_configured(db, settings, provider),
        )
        for provider in SUPPORTED_AI_PROVIDERS
    ]


def _pick_initial_provider(db: Session, settings: Settings) -> AiLlmProvider:
    configured = [item.provider for item in provider_statuses(db, settings) if item.configured]
    return configured[0] if configured else "deepseek"


def _get_selected_provider(db: Session, settings: Settings) -> AiLlmProvider:
    persisted = _setting(db, SELECTED_PROVIDER_KEY)
    if persisted and persisted.value in SUPPORTED_AI_PROVIDERS:
        return persisted.value  # type: ignore[return-value]

    selected = _pick_initial_provider(db, settings)
    _upsert_setting(db, key=SELECTED_PROVIDER_KEY, value=selected, is_secret=False)
    db.commit()
    return selected


def _get_model(db: Session, selected_provider: AiLlmProvider) -> str:
    persisted = _setting(db, MODEL_KEY)
    if persisted and persisted.value.strip():
        return persisted.value.strip()

    model = _DEFAULT_MODEL_BY_PROVIDER[selected_provider]
    _upsert_setting(db, key=MODEL_KEY, value=model, is_secret=False)
    db.commit()
    return model


def _get_temperature(db: Session) -> float:
    persisted = _setting(db, TEMPERATURE_KEY)
    if persisted:
        try:
            value = float(persisted.value)
            if 0 <= value <= 2:
                return value
        except ValueError:
            pass

    _upsert_setting(db, key=TEMPERATURE_KEY, value="0.2", is_secret=False)
    db.commit()
    return 0.2


def _get_max_tokens(db: Session) -> int:
    persisted = _setting(db, MAX_TOKENS_KEY)
    if persisted:
        try:
            value = int(persisted.value)
            if 1 <= value <= 64000:
                return value
        except ValueError:
            pass

    _upsert_setting(db, key=MAX_TOKENS_KEY, value="2048", is_secret=False)
    db.commit()
    return 2048


def _get_system_prompt(db: Session) -> str | None:
    persisted = _setting(db, SYSTEM_PROMPT_KEY)
    if not persisted:
        return None
    value = persisted.value.strip()
    return value or None


def get_ai_llm_config(db: Session, settings: Settings) -> AiLlmConfigResponse:
    selected_provider = _get_selected_provider(db, settings)
    model = _get_model(db, selected_provider)
    temperature = _get_temperature(db)
    max_tokens = _get_max_tokens(db)
    system_prompt = _get_system_prompt(db)

    api_key, base_url = get_provider_runtime_credentials(db, settings, selected_provider)

    return AiLlmConfigResponse(
        selected_provider=selected_provider,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
        system_prompt=system_prompt,
        providers=provider_statuses(db, settings),
        editable=AiLlmEditableFields(
            api_key=_mask_secret(api_key),
            base_url=base_url,
            has_api_key=bool(api_key),
        ),
    )


def update_ai_llm_config(
    db: Session,
    settings: Settings,
    payload: AiLlmConfigUpdateRequest,
) -> AiLlmConfigResponse:
    _upsert_setting(db, key=SELECTED_PROVIDER_KEY, value=payload.selected_provider, is_secret=False)
    _upsert_setting(db, key=MODEL_KEY, value=payload.model.strip(), is_secret=False)
    _upsert_setting(db, key=TEMPERATURE_KEY, value=str(payload.temperature), is_secret=False)
    _upsert_setting(db, key=MAX_TOKENS_KEY, value=str(payload.max_tokens), is_secret=False)
    _upsert_setting(
        db,
        key=SYSTEM_PROMPT_KEY,
        value=(payload.system_prompt or "").strip(),
        is_secret=False,
    )

    if payload.api_key is not None:
        _upsert_setting(
            db,
            key=_provider_key(payload.selected_provider, "api_key"),
            value=_encrypt_secret(settings, payload.api_key.strip()),
            is_secret=True,
        )

    if payload.base_url is not None:
        _upsert_setting(
            db,
            key=_provider_key(payload.selected_provider, "base_url"),
            value=payload.base_url.strip(),
            is_secret=False,
        )

    db.commit()
    return get_ai_llm_config(db, settings)


def get_ai_llm_runtime_config(db: Session, settings: Settings) -> AiLlmRuntimeConfigResponse:
    config = get_ai_llm_config(db, settings)

    selected_provider = config.selected_provider
    selected_api_key, selected_base_url = get_provider_runtime_credentials(db, settings, selected_provider)

    active_provider = selected_provider
    runtime_api_key = selected_api_key
    runtime_base_url = selected_base_url
    model = config.model
    fallback_applied = False

    selected_ready = bool(selected_api_key and selected_base_url)
    if not selected_ready:
        fallback_provider = next(
            (provider.provider for provider in config.providers if provider.configured and provider.provider != selected_provider),
            None,
        )
        if fallback_provider is not None:
            fallback_api_key, fallback_base_url = get_provider_runtime_credentials(db, settings, fallback_provider)
            if fallback_api_key and fallback_base_url:
                active_provider = fallback_provider
                runtime_api_key = fallback_api_key
                runtime_base_url = fallback_base_url
                model = _DEFAULT_MODEL_BY_PROVIDER[fallback_provider]
                fallback_applied = True

    if not (runtime_api_key and runtime_base_url):
        raise ValueError(
            "No configured AI runtime provider found. Configure provider API key and base URL in AI LLM Configuration."
        )

    return AiLlmRuntimeConfigResponse(
        selected_provider=selected_provider,
        active_provider=active_provider,
        fallback_applied=fallback_applied,
        model=model,
        temperature=config.temperature,
        max_tokens=config.max_tokens,
        system_prompt=config.system_prompt,
        providers=config.providers,
        runtime=AiLlmProviderRuntime(
            provider=active_provider,
            api_key=runtime_api_key,
            base_url=runtime_base_url,
        ),
    )
