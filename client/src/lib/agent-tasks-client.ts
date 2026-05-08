import type { AgentTaskCreatePayload, AgentTaskResponse } from "@/lib/api"

type ErrorPayload = {
  message?: string
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    cache: "no-store",
  })
  const payload = (await response.json().catch(() => null)) as (T & ErrorPayload) | null

  if (!response.ok) {
    throw new Error(payload?.message ?? "Request failed")
  }

  return payload as T
}

export function createDashboardAgentTask(payload: AgentTaskCreatePayload): Promise<AgentTaskResponse> {
  return requestJson<AgentTaskResponse>("/api/agent/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
}

export function getDashboardAgentTask(taskId: string): Promise<AgentTaskResponse> {
  return requestJson<AgentTaskResponse>(`/api/agent/tasks/${taskId}`, {
    method: "GET",
  })
}
