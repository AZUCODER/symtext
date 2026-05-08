from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class AgentTaskCreate(BaseModel):
    action: Literal["generate", "summarize", "rewrite", "categorize"]
    content: str = Field(min_length=1, max_length=10000)
    locale: str = Field(default="en")


class AgentTaskResponse(BaseModel):
    task_id: UUID
    status: Literal["queued", "running", "completed", "failed"]
    action: str
    created_at: datetime


class HealthResponse(BaseModel):
    status: str
    service: str
    environment: str
