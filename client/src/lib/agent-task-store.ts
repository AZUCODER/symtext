import type { ContentAgentAction, ContentAgentResult } from "@/lib/ai/content-agent"

export type AgentTaskRecord = {
  task_id: string
  status: "queued" | "running" | "completed" | "failed"
  action: ContentAgentAction
  created_at: string
  result?: ContentAgentResult
  error?: string
}

const TASK_STORE = new Map<string, AgentTaskRecord>()

export function setAgentTask(task: AgentTaskRecord): AgentTaskRecord {
  TASK_STORE.set(task.task_id, task)
  return task
}

export function getAgentTask(taskId: string): AgentTaskRecord | null {
  return TASK_STORE.get(taskId) ?? null
}
