from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.config import get_settings
from app.core.database import get_db
from app.schemas.ai import AiLlmConfigResponse, AiLlmConfigUpdateRequest, AiLlmRuntimeConfigResponse
from app.schemas.auth import UserProfile
from app.services.ai_llm_service import get_ai_llm_config, get_ai_llm_runtime_config, update_ai_llm_config

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/config", response_model=AiLlmConfigResponse)
def get_ai_config(
    current_user: UserProfile = Depends(require_roles({"viewer", "editor", "admin"})),
    db: Session = Depends(get_db),
) -> AiLlmConfigResponse:
    _ = current_user
    settings = get_settings()
    return get_ai_llm_config(db, settings)


@router.put("/config", response_model=AiLlmConfigResponse)
def update_ai_config(
    payload: AiLlmConfigUpdateRequest,
    current_user: UserProfile = Depends(require_roles({"admin"})),
    db: Session = Depends(get_db),
) -> AiLlmConfigResponse:
    _ = current_user
    settings = get_settings()
    return update_ai_llm_config(db, settings, payload)


@router.get("/runtime-config", response_model=AiLlmRuntimeConfigResponse)
def get_ai_runtime_config(
    current_user: UserProfile = Depends(require_roles({"editor", "admin"})),
    db: Session = Depends(get_db),
) -> AiLlmRuntimeConfigResponse:
    _ = current_user
    settings = get_settings()
    return get_ai_llm_runtime_config(db, settings)
