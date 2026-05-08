from fastapi import APIRouter

from app.api.routes.auth import router as auth_router
from app.api.routes.cms import router as cms_router
from app.api.routes.health import router as health_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(cms_router)
