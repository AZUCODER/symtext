from celery import Celery

from app.core.config import get_settings


settings = get_settings()

celery_app = Celery(
    "symtext",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.worker_tasks"],
)

celery_app.conf.update(
    task_default_queue=settings.celery_task_default_queue,
    task_track_started=True,
    enable_utc=True,
    timezone="UTC",
    result_expires=3600,
)