import { API_BASE_URL } from "@/lib/config"
import { withBearerHeaders, withJsonHeaders } from "@/lib/http"

export type HealthResponse = {
  status: string
  service: string
  environment: string
}

export type AgentTaskCreatePayload = {
  action: "generate" | "summarize" | "rewrite" | "categorize"
  content: string
  locale?: string
}

export type AgentTaskResult = {
  title: string
  markdown: string
  summary: string
  keywords: string[]
  category: string
  seo_title: string
  seo_description: string
}

export type AgentTaskResponse = {
  task_id: string
  status: "queued" | "running" | "completed" | "failed"
  action: AgentTaskCreatePayload["action"]
  created_at: string
  result?: AgentTaskResult
  error?: string
}

export type UserProfile = {
  name: string
  email: string
}

export type PricingPlan = {
  code: "free" | "pro" | "enterprise"
  name: string
  price_monthly_usd: number
  description: string
  features: string[]
  cta_label: string
}

export type PricingPlansResponse = {
  plans: PricingPlan[]
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: withJsonHeaders(init?.headers as Record<string, string> | undefined),
    cache: "no-store",
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed with status ${response.status}`)
  }

  return (await response.json()) as T
}

async function apiAuthFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  return apiFetch<T>(path, {
    ...init,
    headers: withBearerHeaders(token, init?.headers as Record<string, string> | undefined),
  })
}

export function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/health", { method: "GET" })
}

export function createAgentTask(payload: AgentTaskCreatePayload, token: string): Promise<AgentTaskResponse> {
  return apiAuthFetch<AgentTaskResponse>("/agent/tasks", token, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function getAgentTask(taskId: string, token: string): Promise<AgentTaskResponse> {
  return apiAuthFetch<AgentTaskResponse>(`/agent/tasks/${taskId}`, token, { method: "GET" })
}

export function getMe(token: string): Promise<UserProfile> {
  return apiAuthFetch<UserProfile>("/auth/me", token, { method: "GET" })
}

export function getPricingPlans(): Promise<PricingPlansResponse> {
  return apiFetch<PricingPlansResponse>("/billing/plans", { method: "GET" })
}
