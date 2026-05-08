from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import require_roles
from app.schemas.auth import UserProfile
from app.schemas.cms import AgentTaskCreate, AgentTaskResponse

router = APIRouter(prefix="/agent", tags=["agent"])

# In-memory placeholder queue for MVP development.
TASK_STORE: dict[UUID, AgentTaskResponse] = {}


@router.post("/tasks", response_model=AgentTaskResponse, status_code=202)
def create_agent_task(
    payload: AgentTaskCreate,
    current_user: UserProfile = Depends(require_roles({"editor", "admin"})),
) -> AgentTaskResponse:
    _ = current_user
    task = AgentTaskResponse(
        task_id=uuid4(),
        status="queued",
        action=payload.action,
        created_at=datetime.now(UTC),
    )
    TASK_STORE[task.task_id] = task
    return task


@router.get("/tasks/{task_id}", response_model=AgentTaskResponse)
def get_agent_task(
    task_id: UUID,
    current_user: UserProfile = Depends(require_roles({"editor", "admin"})),
) -> AgentTaskResponse:
    _ = current_user
    task = TASK_STORE.get(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task
