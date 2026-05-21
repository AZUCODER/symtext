from app.worker import celery_app


@celery_app.task(name="app.tasks.ping")
def ping_task() -> dict[str, str]:
    return {"status": "ok"}