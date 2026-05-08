from fastapi import APIRouter

from app.core.config import get_settings
from app.schemas.cms import HealthResponse

router = APIRouter(prefix="/health", tags=["health"])


@router.get("", response_model=HealthResponse)
def healthcheck() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        status="ok",
        service=settings.app_name,
        environment=settings.environment,
    )
