import type { AiLlmConfig, AiLlmConfigUpdatePayload } from "@/lib/dashboard-types"
import { withJsonHeaders } from "@/lib/http"

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message?: unknown }).message ?? "Failed to fetch AI LLM configuration")
        : "Failed to fetch AI LLM configuration"
    throw new Error(message)
  }
  return payload as T
}

export async function fetchAiLlmConfig(): Promise<AiLlmConfig> {
  const response = await fetch("/api/ai/config", {
    method: "GET",
    cache: "no-store",
  })
  return parseResponse<AiLlmConfig>(response)
}

export async function updateAiLlmConfig(payload: AiLlmConfigUpdatePayload): Promise<AiLlmConfig> {
  const response = await fetch("/api/ai/config", {
    method: "PUT",
    headers: withJsonHeaders(),
    body: JSON.stringify(payload),
  })
  return parseResponse<AiLlmConfig>(response)
}
