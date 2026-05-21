from pydantic import BaseModel, Field
from typing import Literal

AiLlmProvider = Literal["deepseek", "openai", "groq", "openai_compatible"]


class AiLlmProviderStatus(BaseModel):
    provider: AiLlmProvider
    configured: bool


class AiLlmEditableFields(BaseModel):
    api_key: str = ""
    base_url: str = ""
    has_api_key: bool = False


class AiLlmConfigResponse(BaseModel):
    selected_provider: AiLlmProvider
    model: str = Field(min_length=1, max_length=128)
    temperature: float = Field(ge=0, le=2)
    max_tokens: int = Field(ge=1, le=64000)
    system_prompt: str | None = Field(default=None, max_length=4000)
    providers: list[AiLlmProviderStatus]
    editable: AiLlmEditableFields


class AiLlmConfigUpdateRequest(BaseModel):
    selected_provider: AiLlmProvider
    model: str = Field(min_length=1, max_length=128)
    temperature: float = Field(ge=0, le=2)
    max_tokens: int = Field(ge=1, le=64000)
    system_prompt: str | None = Field(default=None, max_length=4000)
    api_key: str | None = Field(default=None, max_length=512)
    base_url: str | None = Field(default=None, max_length=512)


class AiLlmProviderRuntime(BaseModel):
    provider: AiLlmProvider
    api_key: str
    base_url: str


class AiLlmRuntimeConfigResponse(BaseModel):
    selected_provider: AiLlmProvider
    active_provider: AiLlmProvider
    fallback_applied: bool
    model: str = Field(min_length=1, max_length=128)
    temperature: float = Field(ge=0, le=2)
    max_tokens: int = Field(ge=1, le=64000)
    system_prompt: str | None = Field(default=None, max_length=4000)
    providers: list[AiLlmProviderStatus]
    runtime: AiLlmProviderRuntime
