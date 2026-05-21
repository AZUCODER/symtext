import type { CloudOssConfig, CloudOssConfigUpdatePayload } from "@/lib/dashboard-types"
import { withJsonHeaders } from "@/lib/http"

type ErrorPayload = {
  message?: string
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { ...init, cache: "no-store" })
  const payload = (await response.json().catch(() => null)) as (T & ErrorPayload) | null

  if (!response.ok) {
    throw new Error(payload?.message ?? `Request failed: ${response.status}`)
  }

  return (payload ?? {}) as T
}

export async function getCloudOssConfig(): Promise<CloudOssConfig> {
  return requestJson<CloudOssConfig>("/api/media/oss/config", { method: "GET" })
}

export async function updateCloudOssConfig(payload: CloudOssConfigUpdatePayload): Promise<CloudOssConfig> {
  return requestJson<CloudOssConfig>("/api/media/oss/config", {
    method: "PUT",
    headers: withJsonHeaders(),
    body: JSON.stringify(payload),
  })
}
