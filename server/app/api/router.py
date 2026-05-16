from fastapi import APIRouter

from app.api.routes.ai import router as ai_router
from app.api.routes.auth import router as auth_router
from app.api.routes.billing import router as billing_router
from app.api.routes.blog import router as blog_router
from app.api.routes.cms import router as cms_router
from app.api.routes.health import router as health_router
from app.api.routes.media import router as media_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(cms_router)
api_router.include_router(blog_router)
api_router.include_router(media_router)
api_router.include_router(ai_router)
api_router.include_router(billing_router)
