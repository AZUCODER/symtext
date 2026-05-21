from typing import Literal

from pydantic import BaseModel, Field, field_validator


MediaType = Literal["image", "video", "audio", "file"]
CloudOssProvider = Literal["aliyunoss", "huaweioss", "awsoss"]


class OssSignUploadRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    content_type: str | None = Field(default=None, max_length=255)
    media_type: MediaType = "file"
    folder: str | None = Field(default=None, max_length=64)

    @field_validator("filename")
    @classmethod
    def validate_filename(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("filename is required")
        if "/" in trimmed or "\\" in trimmed:
            raise ValueError("filename must not include path separators")
        return trimmed

    @field_validator("folder")
    @classmethod
    def validate_folder(cls, value: str | None) -> str | None:
        if value is None:
            return value
        trimmed = value.strip().strip("/")
        if not trimmed:
            return None
        return trimmed


class OssSignUploadResponse(BaseModel):
    method: Literal["PUT"] = "PUT"
    provider: CloudOssProvider
    upload_url: str
    object_key: str
    public_url: str
    expires_in_seconds: int
    max_upload_bytes: int
    headers: dict[str, str] = Field(default_factory=dict)


class CloudOssProviderStatus(BaseModel):
    provider: CloudOssProvider
    configured: bool
    supports_signed_upload: bool


class CloudOssEditableFields(BaseModel):
    endpoint: str = ""
    bucket_name: str = ""
    public_base_url: str = ""
    access_key_id: str = ""
    access_key_secret: str = ""
    has_access_key_id: bool = False
    has_access_key_secret: bool = False


class CloudOssConfigResponse(BaseModel):
    selected_provider: CloudOssProvider
    providers: list[CloudOssProviderStatus]
    editable: CloudOssEditableFields


class CloudOssConfigUpdateRequest(BaseModel):
    selected_provider: CloudOssProvider
    endpoint: str = ""
    bucket_name: str = ""
    public_base_url: str = ""
    access_key_id: str | None = None
    access_key_secret: str | None = None

    @field_validator("endpoint", "bucket_name", "public_base_url", mode="before")
    @classmethod
    def normalize_text_fields(cls, value: str | None) -> str:
        return (value or "").strip()
