"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { fetchAiLlmConfig, updateAiLlmConfig } from "@/lib/ai-llm-config-client"
import type { AiLlmConfig, AiLlmProvider } from "@/lib/dashboard-types"
import { queryKeys } from "@/lib/query-keys"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const PROVIDER_LABELS: Record<AiLlmProvider, string> = {
  deepseek: "DeepSeek",
  openai: "OpenAI",
  groq: "Groq",
  openai_compatible: "OpenAI Compatible",
}

const DEFAULT_MODEL_BY_PROVIDER: Record<AiLlmProvider, string> = {
  deepseek: "deepseek-chat",
  openai: "gpt-4.1-mini",
  groq: "llama-3.3-70b-versatile",
  openai_compatible: "gpt-4o-mini",
}

export function AiLlmConfiguration({ currentUserRole }: { currentUserRole: "viewer" | "editor" | "admin" }) {
  const queryClient = useQueryClient()
  const [feedback, setFeedback] = useState<string | null>(null)
  const [draft, setDraft] = useState<{
    selected_provider: AiLlmProvider
    model: string
    temperature: string
    max_tokens: string
    system_prompt: string
    api_key: string
    base_url: string
    has_api_key: boolean
  } | null>(null)

  const canManage = currentUserRole === "admin"

  const configQuery = useQuery({
    queryKey: queryKeys.aiLlmConfig,
    queryFn: fetchAiLlmConfig,
    staleTime: 30_000,
  })

  const saveMutation = useMutation({
    mutationFn: updateAiLlmConfig,
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.aiLlmConfig, updated)
      setFeedback(`AI provider updated to ${PROVIDER_LABELS[updated.selected_provider]} (${updated.model}).`)
      setDraft(toDraft(updated))
    },
    onError: (error) => {
      setFeedback(error instanceof Error ? error.message : "Failed to update AI configuration")
    },
  })

  const effectiveDraft = useMemo(() => {
    if (draft) {
      return draft
    }
    if (configQuery.data) {
      return toDraft(configQuery.data)
    }
    return {
      selected_provider: "deepseek" as AiLlmProvider,
      model: DEFAULT_MODEL_BY_PROVIDER.deepseek,
      temperature: "0.2",
      max_tokens: "2048",
      system_prompt: "",
      api_key: "",
      base_url: "",
      has_api_key: false,
    }
  }, [configQuery.data, draft])

  const selectedStatus = useMemo(() => {
    if (!configQuery.data) {
      return null
    }
    return configQuery.data.providers.find((item) => item.provider === effectiveDraft.selected_provider) ?? null
  }, [configQuery.data, effectiveDraft.selected_provider])

  const hasPendingChanges = useMemo(() => {
    if (!configQuery.data) {
      return false
    }
    const current = toDraft(configQuery.data)
    return JSON.stringify(current) !== JSON.stringify(effectiveDraft)
  }, [configQuery.data, effectiveDraft])

  function patchDraft(next: Partial<typeof effectiveDraft>) {
    setFeedback(null)
    setDraft((prev) => {
      const baseline = prev ?? toDraft(configQuery.data)
      return {
        ...baseline,
        ...next,
      }
    })
  }

  function toDraftOrThrow() {
    const temperature = Number.parseFloat(effectiveDraft.temperature)
    if (Number.isNaN(temperature) || temperature < 0 || temperature > 2) {
      throw new Error("Temperature must be a number between 0 and 2")
    }

    const maxTokens = Number.parseInt(effectiveDraft.max_tokens, 10)
    if (Number.isNaN(maxTokens) || maxTokens < 1 || maxTokens > 64000) {
      throw new Error("Max tokens must be between 1 and 64000")
    }

    if (!effectiveDraft.model.trim()) {
      throw new Error("Model cannot be empty")
    }

    if (effectiveDraft.selected_provider === "openai_compatible" && !effectiveDraft.base_url.trim()) {
      throw new Error("Base URL is required for openai_compatible provider")
    }

    return {
      selected_provider: effectiveDraft.selected_provider,
      model: effectiveDraft.model.trim(),
      temperature,
      max_tokens: maxTokens,
      system_prompt: effectiveDraft.system_prompt.trim() || null,
      ...(effectiveDraft.api_key.trim() ? { api_key: effectiveDraft.api_key.trim() } : {}),
      ...(effectiveDraft.selected_provider === "openai_compatible"
        ? { base_url: effectiveDraft.base_url.trim() }
        : {}),
    }
  }

  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>AI LLM Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {configQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading AI provider settings...</p>
          ) : (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="ai-provider">Active Provider</FieldLabel>
                <Select
                  value={effectiveDraft.selected_provider}
                  onValueChange={(value) => {
                    const provider = value as AiLlmProvider
                    patchDraft({
                      selected_provider: provider,
                      model:
                        effectiveDraft.model === DEFAULT_MODEL_BY_PROVIDER[effectiveDraft.selected_provider]
                          ? DEFAULT_MODEL_BY_PROVIDER[provider]
                          : effectiveDraft.model,
                      api_key: "",
                      has_api_key: false,
                    })
                  }}
                  disabled={!canManage || saveMutation.isPending}
                >
                  <SelectTrigger id="ai-provider" className="h-10 w-full rounded-md border-input bg-input/20 px-3 text-sm data-[size=default]:h-10">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deepseek">DeepSeek</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="groq">Groq</SelectItem>
                    <SelectItem value="openai_compatible">OpenAI Compatible</SelectItem>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Provider selection controls which LLM backend BlockNote AI uses in the dashboard.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="ai-api-key">Provider API Key</FieldLabel>
                <Input
                  id="ai-api-key"
                  type="password"
                  value={effectiveDraft.api_key}
                  onChange={(event) => patchDraft({ api_key: event.target.value })}
                  disabled={!canManage || saveMutation.isPending}
                  placeholder={configQuery.data?.editable.api_key || "Enter provider API key"}
                />
                <FieldDescription>
                  Stored key: {effectiveDraft.has_api_key ? "Configured" : "Not configured"}. Leave blank to keep current key.
                </FieldDescription>
              </Field>

              {effectiveDraft.selected_provider === "openai_compatible" && (
                <Field>
                  <FieldLabel htmlFor="ai-base-url">OpenAI Compatible Base URL</FieldLabel>
                  <Input
                    id="ai-base-url"
                    value={effectiveDraft.base_url}
                    onChange={(event) => patchDraft({ base_url: event.target.value })}
                    disabled={!canManage || saveMutation.isPending}
                    placeholder="https://your-openai-compatible-endpoint/v1"
                  />
                </Field>
              )}

              <Field>
                <FieldLabel htmlFor="ai-model">Model</FieldLabel>
                <Input
                  id="ai-model"
                  value={effectiveDraft.model}
                  onChange={(event) => patchDraft({ model: event.target.value })}
                  disabled={!canManage || saveMutation.isPending}
                  placeholder="e.g. deepseek-chat"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="ai-temperature">Temperature</FieldLabel>
                <Input
                  id="ai-temperature"
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={effectiveDraft.temperature}
                  onChange={(event) => patchDraft({ temperature: event.target.value })}
                  disabled={!canManage || saveMutation.isPending}
                />
                <FieldDescription>Controls creativity. Lower is deterministic, higher is more exploratory.</FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="ai-max-tokens">Max Tokens</FieldLabel>
                <Input
                  id="ai-max-tokens"
                  type="number"
                  min={1}
                  max={64000}
                  step={1}
                  value={effectiveDraft.max_tokens}
                  onChange={(event) => patchDraft({ max_tokens: event.target.value })}
                  disabled={!canManage || saveMutation.isPending}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="ai-system-prompt">System Prompt Override</FieldLabel>
                <textarea
                  id="ai-system-prompt"
                  className="min-h-28 w-full rounded-md border border-input bg-input/20 px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                  value={effectiveDraft.system_prompt}
                  onChange={(event) => patchDraft({ system_prompt: event.target.value })}
                  disabled={!canManage || saveMutation.isPending}
                  placeholder="Optional. Leave empty to use default BlockNote AI system prompt."
                />
                <FieldDescription>
                  Optional prompt prefix applied to all BlockNote AI editing requests.
                </FieldDescription>
              </Field>
            </FieldGroup>
          )}

          {selectedStatus && (
            <div className="rounded-md border border-border/70 p-3 text-sm">
              <p>
                Provider status: {selectedStatus.configured ? "Configured" : "Not configured"}
              </p>
            </div>
          )}

          {feedback && <p className="text-sm text-muted-foreground">{feedback}</p>}
          {!feedback && configQuery.error instanceof Error && (
            <p className="text-sm text-destructive">{configQuery.error.message}</p>
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              disabled={!canManage || saveMutation.isPending || !hasPendingChanges}
              onClick={() => {
                try {
                  saveMutation.mutate(toDraftOrThrow())
                } catch (error) {
                  setFeedback(error instanceof Error ? error.message : "Invalid AI configuration")
                }
              }}
            >
              {saveMutation.isPending ? "Saving..." : "Save AI Configuration"}
            </Button>
            {!canManage && (
              <span className="text-sm text-muted-foreground">Only admin can update this configuration.</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function toDraft(config: AiLlmConfig | undefined) {
  return {
    selected_provider: config?.selected_provider ?? ("deepseek" as AiLlmProvider),
    model: config?.model ?? DEFAULT_MODEL_BY_PROVIDER.deepseek,
    temperature: String(config?.temperature ?? 0.2),
    max_tokens: String(config?.max_tokens ?? 2048),
    system_prompt: config?.system_prompt ?? "",
    api_key: "",
    base_url: config?.editable.base_url ?? "",
    has_api_key: Boolean(config?.editable.has_api_key),
  }
}
