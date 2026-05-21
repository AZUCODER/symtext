import mimetypes
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from urllib.parse import quote, urlparse
from uuid import uuid4

import oss2

from app.core.config import Settings
from app.schemas.media import MediaType


SAFE_FILENAME_PATTERN = re.compile(r"[^A-Za-z0-9._-]+")
SAFE_FOLDER_PATTERN = re.compile(r"[^A-Za-z0-9/_-]+")


class OssNotConfiguredError(ValueError):
    pass


class OssValidationError(ValueError):
    pass


class OssServiceError(RuntimeError):
    pass


@dataclass(frozen=True)
class OssSignedUpload:
    upload_url: str
    object_key: str
    public_url: str
    headers: dict[str, str]


class OssService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._bucket: oss2.Bucket | None = None

    def sign_upload(
        self,
        *,
        filename: str,
        media_type: MediaType,
        content_type: str | None = None,
        folder: str | None = None,
    ) -> OssSignedUpload:
        if not self.is_configured:
            raise OssNotConfiguredError("Alibaba Cloud OSS is not configured")

        guessed_content_type = (content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream").strip()
        self._validate_content_type(media_type=media_type, content_type=guessed_content_type)

        object_key = self._build_object_key(filename=filename, media_type=media_type, folder=folder)
        headers = {"Content-Type": guessed_content_type}

        try:
            signed_upload_url = self.bucket.sign_url(
                "PUT",
                object_key,
                self.settings.oss_signed_url_expires_seconds,
                headers=headers,
            )
        except Exception as error:
            raise OssServiceError("Failed to create OSS signed upload URL") from error

        return OssSignedUpload(
            upload_url=signed_upload_url,
            object_key=object_key,
            public_url=self._build_public_url(object_key),
            headers=headers,
        )

    def sign_read_url(self, object_key: str) -> str:
        if not self.is_configured:
            raise OssNotConfiguredError("Alibaba Cloud OSS is not configured")

        normalized_key = object_key.strip().lstrip("/")
        if not normalized_key:
            raise OssValidationError("object_key is required")

        try:
            return self.bucket.sign_url(
                "GET",
                normalized_key,
                self.settings.oss_signed_url_expires_seconds,
            )
        except Exception as error:
            raise OssServiceError("Failed to create OSS signed read URL") from error

    @property
    def is_configured(self) -> bool:
        return all(
            [
                self.settings.oss_endpoint.strip(),
                self.settings.oss_bucket_name.strip(),
                self.settings.oss_access_key_id.strip(),
                self.settings.oss_access_key_secret.strip(),
            ]
        )

    @property
    def bucket(self) -> oss2.Bucket:
        if self._bucket is None:
            endpoint = self._normalize_endpoint(self.settings.oss_endpoint)
            auth = oss2.Auth(self.settings.oss_access_key_id, self.settings.oss_access_key_secret)
            self._bucket = oss2.Bucket(auth, endpoint, self.settings.oss_bucket_name)
        return self._bucket

    def _build_object_key(self, *, filename: str, media_type: MediaType, folder: str | None) -> str:
        safe_name = self._sanitize_filename(filename)
        date_path = datetime.now(UTC).strftime("%Y/%m/%d")
        root = self.settings.oss_upload_dir.strip("/") or "uploads"
        folder_key = self._sanitize_folder(folder)
        key_parts = [root, media_type]
        if folder_key:
            key_parts.append(folder_key)
        key_parts.append(date_path)
        key_parts.append(f"{uuid4().hex}_{safe_name}")
        return "/".join(key_parts)

    def _build_public_url(self, object_key: str) -> str:
        custom_base = self.settings.oss_public_base_url.strip()
        if custom_base:
            base = custom_base.rstrip("/")
        else:
            endpoint = self._normalize_endpoint(self.settings.oss_endpoint)
            parsed = urlparse(endpoint)
            base = f"https://{self.settings.oss_bucket_name}.{parsed.netloc}"
        return f"{base}/{quote(object_key, safe='/')}"

    def _validate_content_type(self, *, media_type: MediaType, content_type: str) -> None:
        if media_type == "file":
            return
        if media_type == "image" and content_type.startswith("image/"):
            return
        if media_type == "video" and content_type.startswith("video/"):
            return
        if media_type == "audio" and content_type.startswith("audio/"):
            return
        raise OssValidationError(f"content_type '{content_type}' is invalid for media_type '{media_type}'")

    @staticmethod
    def _normalize_endpoint(endpoint: str) -> str:
        trimmed = endpoint.strip().rstrip("/")
        if trimmed.startswith("http://") or trimmed.startswith("https://"):
            return trimmed
        return f"https://{trimmed}"

    @staticmethod
    def _sanitize_filename(filename: str) -> str:
        normalized = SAFE_FILENAME_PATTERN.sub("-", filename.strip()).strip(".-")
        if not normalized:
            return "file"
        return normalized

    @staticmethod
    def _sanitize_folder(folder: str | None) -> str | None:
        if not folder:
            return None
        normalized = SAFE_FOLDER_PATTERN.sub("-", folder.strip()).strip("/")
        if not normalized:
            return None
        return normalized
