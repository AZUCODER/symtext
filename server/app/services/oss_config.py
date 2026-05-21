from urllib.parse import urlparse

from app.core.config import Settings


def parse_bucket_name_from_public_base_url(public_base_url: str) -> str | None:
    trimmed = public_base_url.strip()
    if not trimmed:
        return None

    candidate = trimmed
    if not (candidate.startswith("http://") or candidate.startswith("https://")):
        candidate = f"https://{candidate}"

    parsed = urlparse(candidate)
    host = parsed.netloc.strip()
    if not host:
        return None

    bucket = host.split(".", 1)[0].strip()
    return bucket or None


def resolve_aliyun_bucket_name(settings: Settings) -> str | None:
    configured_bucket = settings.oss_bucket_name.strip()
    if configured_bucket:
        return configured_bucket
    return parse_bucket_name_from_public_base_url(settings.oss_public_base_url)
