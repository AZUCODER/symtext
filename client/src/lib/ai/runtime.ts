import { createOpenAICompatible } from "@ai-sdk/openai-compatible"

import { API_BASE_URL } from "@/lib/config"
import { withBearerHeaders } from "@/lib/http"

export type AiLlmProvider = "deepseek" | "openai" | "groq" | "openai_compatible"

export type AiLlmRuntimeConfigResponse = {
  selected_provider: AiLlmProvider
  active_provider: AiLlmProvider
  fallback_applied: boolean
  model: string
  temperature: number
  max_tokens: number
  system_prompt: string | null
  providers: Array<{
    provider: AiLlmProvider
    configured: boolean
  }>
  runtime: {
    provider: AiLlmProvider
    api_key: string
    base_url: string
  }
}

type ProviderRuntime = {
  apiKey: string
  baseURL: string
  name: string
}

export type ResolvedAiRuntime = {
  config: AiLlmRuntimeConfigResponse
  runtime: ProviderRuntime
  requestedProvider: AiLlmProvider
  activeProvider: AiLlmProvider
  fallbackApplied: boolean
}

function hasRuntimeCredentials(runtime: ProviderRuntime): boolean {
  return runtime.apiKey.trim().length > 0 && runtime.baseURL.trim().length > 0
}

export async function getRuntimeConfig(accessToken: string): Promise<AiLlmRuntimeConfigResponse> {
  const upstream = await fetch(`${API_BASE_URL}/ai/runtime-config`, {
    method: "GET",
    headers: withBearerHeaders(accessToken),
    cache: "no-store",
  })

  const payload = await upstream.json().catch(() => null)
  if (!upstream.ok || !payload) {
    throw new Error("Failed to fetch AI runtime configuration")
  }

  return payload as AiLlmRuntimeConfigResponse
}

export async function resolveAiRuntime(accessToken: string): Promise<ResolvedAiRuntime> {
  const config = await getRuntimeConfig(accessToken)

  const runtime: ProviderRuntime = {
    apiKey: config.runtime.api_key,
    baseURL: config.runtime.base_url,
    name: config.runtime.provider,
  }

  if (!hasRuntimeCredentials(runtime)) {
    throw new Error("Resolved AI runtime has missing API key or base URL")
  }

  return {
    config,
    runtime,
    requestedProvider: config.selected_provider,
    activeProvider: config.active_provider,
    fallbackApplied: config.fallback_applied,
  }
}

export function createRuntimeModel(runtime: ProviderRuntime, model: string) {
  const provider = createOpenAICompatible({
    name: runtime.name,
    apiKey: runtime.apiKey,
    baseURL: runtime.baseURL,
  })

  return provider(model)
}
