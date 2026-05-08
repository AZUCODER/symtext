# Integrating AI Agent into Symtext CMS

This document is the implementation reference for adding AI agent capabilities to the Symtext CMS. It is organized as **MVP phases** — build the smallest thing that works, validate it, then expand.

---

## Current State (Phase 0 — Already Built)

The foundation is in place. Before writing a single line of new agent code, understand what already exists:

| Layer | File | What it does |
|---|---|---|
| Schema | `server/app/schemas/cms.py` | `AgentTaskCreate` (action, content, locale) and `AgentTaskResponse` (task_id, status, action, created_at) |
| API route | `server/app/api/routes/cms.py` | `POST /agent/tasks` and `GET /agent/tasks/{task_id}` — RBAC-guarded (editor/admin), in-memory store |
| Next.js proxy | `client/src/app/api/agent/tasks/route.ts` | Proxies to FastAPI with `Authorization: Bearer` token |
| Client lib | `client/src/lib/agent-tasks-client.ts` | `createDashboardAgentTask`, `getDashboardAgentTask` |
| UI | `client/src/components/dashboard/dashboard-agent-task.tsx` | Form to submit a task and poll its status (TanStack Query) |
| Page | `client/src/app/(dashboard)/dashboard/agent-tools/page.tsx` | Mounts `DashboardAgentTask`, requires authenticated session |

The task `action` enum is already defined: `generate | summarize | rewrite | categorize`.

**What is missing:** the tasks are queued but never executed — `TASK_STORE` is an in-memory dict and no LLM is called. That is the only gap between now and a working MVP.

---

## Architecture

```
[Browser] --- Next.js (App Router) --- /api/agent/* proxy --- FastAPI
                                                                   |
                                                          BackgroundTask
                                                                   |
                                                          Pydantic AI Agent
                                                           +- system prompt (action-specific)
                                                           +- LLM call (OpenAI / Anthropic)
                                                           +- stores result in task store
```

For the MVP, **no Celery, no Redis, no LangGraph**. FastAPI's built-in `BackgroundTasks` is sufficient for single-user / low-concurrency scenarios. Add a task queue only when you have measured a need for it.

---

## Phase 1 — Wire up a Real LLM (MVP)

**Goal:** submitted tasks actually run and return a result.

### 1.1 Add dependencies

```txt
# server/requirements.txt
pydantic-ai>=0.0.14
openai>=1.0.0        # or anthropic>=0.25.0
```

### 1.2 Extend the schema

Add `result` and `error` fields to `AgentTaskResponse` so the frontend can display output.

```python
# server/app/schemas/cms.py
class AgentTaskResponse(BaseModel):
    task_id: UUID
    status: Literal["queued", "running", "completed", "failed"]
    action: str
    result: str | None = None          # add this
    error: str | None = None           # add this
    created_at: datetime
```

### 1.3 Create the agent service

```python
# server/app/services/agent_runner.py
from pydantic_ai import Agent
from app.schemas.cms import AgentTaskResponse

SYSTEM_PROMPTS: dict[str, str] = {
    "generate":   "You are a CMS content writer. Generate clear, concise content based on the user's input.",
    "summarize":  "You are a CMS editor. Summarize the provided content in 2-3 sentences.",
    "rewrite":    "You are a CMS copywriter. Rewrite the provided content to improve clarity and tone.",
    "categorize": "You are a CMS taxonomist. Return a JSON list of relevant category labels for the content.",
}


async def run_agent_task(task: AgentTaskResponse, content: str) -> None:
    """Run the agent in the background and update the task in-place."""
    task.status = "running"
    try:
        agent = Agent(
            "openai:gpt-4o-mini",
            system_prompt=SYSTEM_PROMPTS.get(task.action, SYSTEM_PROMPTS["generate"]),
        )
        result = await agent.run(content)
        task.result = result.output
        task.status = "completed"
    except Exception as exc:  # noqa: BLE001
        task.error = str(exc)
        task.status = "failed"
```

> `openai:gpt-4o-mini` is cheap and fast — ideal for an MVP. Swap the model string to change providers; Pydantic AI supports `anthropic:claude-3-5-haiku`, `google-gla:gemini-2.0-flash`, and others without any other code change.

### 1.4 Update the CMS route

```python
# server/app/api/routes/cms.py
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from app.services.agent_runner import run_agent_task

@router.post("/tasks", response_model=AgentTaskResponse, status_code=202)
async def create_agent_task(
    payload: AgentTaskCreate,
    background_tasks: BackgroundTasks,
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
    background_tasks.add_task(run_agent_task, task, payload.content)
    return task
```

### 1.5 Add the API key to environment

```bash
# server/.env
OPENAI_API_KEY=sk-...
```

```python
# server/app/core/config.py  (add to Settings)
openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
```

### 1.6 Update the frontend to display results

Extend the `AgentTaskResponse` type in `client/src/lib/api.ts`:

```typescript
export type AgentTaskResponse = {
  task_id: string
  status: "queued" | "running" | "completed" | "failed"
  action: string
  result: string | null
  error: string | null
  created_at: string
}
```

Enable auto-polling in `DashboardAgentTask` so the UI updates until the task finishes:

```typescript
// client/src/components/dashboard/dashboard-agent-task.tsx
const taskStatusQuery = useQuery({
  queryKey: queryKeys.agentTask(trimmedTaskId),
  queryFn: () => getDashboardAgentTask(trimmedTaskId),
  enabled: !!trimmedTaskId,
  refetchInterval: (query) => {
    const status = query.state.data?.status
    return status === "queued" || status === "running" ? 2000 : false
  },
})
```

**Outcome of Phase 1:** editors can submit content, the backend calls an LLM, and the result appears in the UI within seconds — using the architecture that already exists.

---

## Phase 2 — Streaming Chat Interface

**Goal:** add a conversational "Ask the agent" panel so editors interact with the agent in natural language instead of picking a discrete action.

### 2.1 FastAPI streaming endpoint

```python
# server/app/api/routes/agent_chat.py
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pydantic_ai import Agent

from app.api.deps import get_current_user

router = APIRouter(prefix="/agent", tags=["agent"])

chat_agent = Agent(
    "openai:gpt-4o-mini",
    system_prompt=(
        "You are a CMS assistant for Symtext. "
        "Help editors write, improve, and organize content."
    ),
)


class ChatRequest(BaseModel):
    messages: list[dict]  # Vercel AI SDK message format


@router.post("/chat")
async def agent_chat(
    body: ChatRequest,
    current_user=Depends(get_current_user),
):
    user_message = body.messages[-1]["content"] if body.messages else ""

    async def token_stream():
        async with chat_agent.run_stream(user_message) as stream:
            async for chunk in stream.stream_text(delta=True):
                # Vercel AI SDK data-stream protocol: prefix "0:"
                yield f'0:{chunk!r}\n'

    return StreamingResponse(token_stream(), media_type="text/plain")
```

### 2.2 Next.js API proxy for chat

```typescript
// client/src/app/api/agent/chat/route.ts
import { auth } from "@/auth"
import { API_BASE_URL } from "@/app/api/_lib/auth"

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.accessToken) {
    return new Response("Unauthorized", { status: 401 })
  }

  const body = await request.json()
  const upstream = await fetch(`${API_BASE_URL}/agent/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify(body),
  })

  return new Response(upstream.body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
```

### 2.3 Chat component (Vercel AI SDK)

```typescript
// client/src/components/dashboard/dashboard-agent-chat.tsx
"use client"

import { useChat } from "ai/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function DashboardAgentChat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/agent/chat",
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ask the Agent</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-64 overflow-y-auto space-y-2">
          {messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "text-right" : "text-left"}>
              <span className="inline-block rounded px-3 py-1 text-sm bg-muted">
                {m.content}
              </span>
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input value={input} onChange={handleInputChange} placeholder="Ask anything about your content..." />
          <Button type="submit" disabled={isLoading}>Send</Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

---

## Phase 3 — Human-in-the-Loop Approval

**Goal:** for high-stakes actions (bulk rewrite, publish), the agent proposes a change and a human must approve before it is applied.

This requires:

1. A `pending_approval` status and a `proposed_result` field in `AgentTaskResponse`.
2. A `POST /agent/tasks/{task_id}/resolve` endpoint that accepts `{ "approved": true }`.
3. An approval card in the dashboard that shows the proposal and accept/reject buttons.
4. Audit logging of who approved/rejected and when (follow the existing auth role-audit flow and persist events in PostgreSQL).

Implement this only after Phase 1 and Phase 2 are working and you have real editorial feedback on what actually needs human review.

---

## Phase 4 — Production Hardening (Post-MVP)

Not MVP concerns. Add these when you have real load and real users:

- **Persistent task store**: replace the `TASK_STORE` dict with a PostgreSQL table.
- **Task queue**: add ARQ or Celery when background tasks need retries, timeouts, or distributed workers.
- **Cost controls**: track LLM token usage per user; add a hard monthly cap via middleware.
- **Observability**: structured logs for every agent run (model, tokens, latency, action, user). Forward to OpenTelemetry.
- **Multi-agent orchestration**: use Pydantic AI's agent hand-off pattern or CrewAI when you need specialist agents chaining (e.g., Researcher -> Writer -> SEO reviewer).

---

## Framework Choice: Pydantic AI

**Use Pydantic AI** for this project. Reasons:

- Built by the Pydantic team — shares the same type-safety model as FastAPI.
- Minimal API: `Agent`, `Tool`, `RunContext` — no large abstraction layers.
- `VercelAIAdapter` provides a first-class bridge between FastAPI streaming and the Vercel AI SDK `useChat` hook.
- Model-agnostic: swap `"openai:gpt-4o-mini"` for `"anthropic:claude-3-5-haiku"` with no other changes.
- Does not require a separate worker process for the MVP.

For complex multi-agent editorial pipelines (e.g., a Researcher agent handing off to a Writer agent), evaluate **CrewAI** at that point. For now, Pydantic AI handles everything needed for Phases 1-3.

---

## Security Checklist

- [ ] LLM API keys are never exposed to the client — all calls go through FastAPI.
- [ ] Agent routes are RBAC-guarded: `require_roles({"editor", "admin"})` already enforced.
- [ ] Validate and sanitize LLM output before storing or rendering it (treat it as untrusted input).
- [ ] Rate-limit `/agent/tasks` and `/agent/chat` endpoints (reuse `app.core.limiter`).
- [ ] Log all agent actions with user identity for audit trail.