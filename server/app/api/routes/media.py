from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.config import get_settings
from app.core.database import get_db
from app.schemas.auth import UserProfile
from app.schemas.media import (
    CloudOssConfigResponse,
    CloudOssConfigUpdateRequest,
    OssSignUploadRequest,
    OssSignUploadResponse,
)
from app.services.cloud_oss_service import (
    get_cloud_oss_config,
    get_provider_runtime_config,
    get_selected_provider,
    update_cloud_oss_config,
)
from app.services.oss_service import OssNotConfiguredError, OssService, OssServiceError, OssValidationError

router = APIRouter(prefix="/media", tags=["media"])


@router.get("/oss/config", response_model=CloudOssConfigResponse)
def get_cloud_oss_config_route(
    current_user: UserProfile = Depends(require_roles({"admin"})),
    db: Session = Depends(get_db),
) -> CloudOssConfigResponse:
    _ = current_user
    settings = get_settings()
    return get_cloud_oss_config(db, settings)


@router.put("/oss/config", response_model=CloudOssConfigResponse)
def update_cloud_oss_config_route(
    payload: CloudOssConfigUpdateRequest,
    current_user: UserProfile = Depends(require_roles({"admin"})),
    db: Session = Depends(get_db),
) -> CloudOssConfigResponse:
    _ = current_user
    settings = get_settings()
    return update_cloud_oss_config(db, settings, payload)


@router.post("/oss/sign-upload", response_model=OssSignUploadResponse)
def sign_oss_upload(
    payload: OssSignUploadRequest,
    current_user: UserProfile = Depends(require_roles({"editor", "admin"})),
    db: Session = Depends(get_db),
) -> OssSignUploadResponse:
    _ = current_user
    settings = get_settings()
    selected_provider = get_selected_provider(db, settings)

    if selected_provider != "aliyunoss":
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=(
                f"Selected provider '{selected_provider}' is configurable but signed upload is not implemented yet. "
                "Use aliyunoss for direct signed uploads in current MVP."
            ),
        )

    runtime_config = get_provider_runtime_config(db, settings, selected_provider)
    effective_settings = settings.model_copy(
        update={
            "oss_endpoint": runtime_config.endpoint,
            "oss_bucket_name": runtime_config.bucket_name,
            "oss_access_key_id": runtime_config.access_key_id,
            "oss_access_key_secret": runtime_config.access_key_secret,
            "oss_public_base_url": runtime_config.public_base_url,
        }
    )
    service = OssService(effective_settings)

    try:
        signed = service.sign_upload(
            filename=payload.filename,
            content_type=payload.content_type,
            media_type=payload.media_type,
            folder=payload.folder,
        )
    except OssNotConfiguredError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
    except OssValidationError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except OssServiceError as error:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error

    return OssSignUploadResponse(
        provider=selected_provider,
        upload_url=signed.upload_url,
        object_key=signed.object_key,
        public_url=signed.public_url,
        expires_in_seconds=service.settings.oss_signed_url_expires_seconds,
        max_upload_bytes=service.settings.oss_max_upload_bytes,
        headers=signed.headers,
    )


@router.get("/oss/read-url")
def get_oss_read_url(object_key: str, db: Session = Depends(get_db)) -> dict[str, str | int]:
    settings = get_settings()
    selected_provider = get_selected_provider(db, settings)

    if selected_provider != "aliyunoss":
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=(
                f"Selected provider '{selected_provider}' is configurable but signed read URL is not implemented yet. "
                "Use aliyunoss for current MVP."
            ),
        )

    runtime_config = get_provider_runtime_config(db, settings, selected_provider)
    effective_settings = settings.model_copy(
        update={
            "oss_endpoint": runtime_config.endpoint,
            "oss_bucket_name": runtime_config.bucket_name,
            "oss_access_key_id": runtime_config.access_key_id,
            "oss_access_key_secret": runtime_config.access_key_secret,
            "oss_public_base_url": runtime_config.public_base_url,
        }
    )
    service = OssService(effective_settings)

    try:
        read_url = service.sign_read_url(object_key)
    except OssNotConfiguredError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
    except OssValidationError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except OssServiceError as error:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error

    return {
        "url": read_url,
        "expires_in_seconds": service.settings.oss_signed_url_expires_seconds,
    }
