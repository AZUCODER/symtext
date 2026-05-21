"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { getBillingConfig, updateBillingConfig } from "@/lib/billing-client"
import type { BillingMode, BillingProvider } from "@/lib/dashboard-types"
import { queryKeys } from "@/lib/query-keys"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Toggle } from "@/components/ui/toggle"

type Draft = {
  selected_provider: BillingProvider
  mode: BillingMode
  enabled: boolean
  app_id: string
  secret: string
  webhook_secret: string
}

export function BillingConfiguration({ currentUserRole }: { currentUserRole: "viewer" | "editor" | "admin" }) {
  const canManage = currentUserRole === "admin"
  const queryClient = useQueryClient()
  const [feedback, setFeedback] = useState<string | null>(null)
  const [draftOverrides, setDraftOverrides] = useState<Partial<Draft>>({})

  const configQuery = useQuery({
    queryKey: queryKeys.billingConfig,
    queryFn: getBillingConfig,
    staleTime: 30_000,
  })

  const draft = useMemo<Draft | null>(() => {
    if (!configQuery.data) {
      return null
    }

    return {
      selected_provider: draftOverrides.selected_provider ?? configQuery.data.selected_provider,
      mode: draftOverrides.mode ?? configQuery.data.mode,
      enabled: draftOverrides.enabled ?? configQuery.data.enabled,
      app_id: draftOverrides.app_id ?? "",
      secret: draftOverrides.secret ?? "",
      webhook_secret: draftOverrides.webhook_secret ?? "",
    }
  }, [configQuery.data, draftOverrides])

  const mutation = useMutation({
    mutationFn: () => {
      if (!draft) {
        throw new Error("Billing configuration is not loaded")
      }
      return updateBillingConfig({
        selected_provider: draft.selected_provider,
        mode: draft.mode,
        enabled: draft.enabled,
        ...(draft.app_id.trim() ? { app_id: draft.app_id.trim() } : {}),
        ...(draft.secret.trim() ? { secret: draft.secret.trim() } : {}),
        ...(draft.webhook_secret.trim() ? { webhook_secret: draft.webhook_secret.trim() } : {}),
      })
    },
    onSuccess: (next) => {
      queryClient.setQueryData(queryKeys.billingConfig, next)
      setFeedback(`Billing configuration saved for ${next.selected_provider}.`)
      setDraftOverrides({})
    },
    onError: (error) => {
      setFeedback(error instanceof Error ? error.message : "Failed to update billing configuration")
    },
  })

  const selectedProviderStatus = configQuery.data?.providers.find((p) => p.provider === draft?.selected_provider)
  const editable = configQuery.data?.editable

  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Billing Gateway Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {configQuery.isLoading || !draft ? (
            <p className="text-sm text-muted-foreground">Loading billing configuration...</p>
          ) : (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="billing-provider">Provider</FieldLabel>
                <Select
                  value={draft.selected_provider}
                  disabled={!canManage || mutation.isPending}
                  onValueChange={(value) => {
                    setFeedback(null)
                    setDraftOverrides((current) => ({
                      ...current,
                      selected_provider: value as BillingProvider,
                    }))
                  }}
                >
                  <SelectTrigger id="billing-provider" className="h-10 w-full rounded-md border-input bg-input/20 px-3 text-sm data-[size=default]:h-10">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="alipay">Alipay</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="billing-mode">Mode</FieldLabel>
                <Select
                  value={draft.mode}
                  disabled={!canManage || mutation.isPending}
                  onValueChange={(value) => {
                    setFeedback(null)
                    setDraftOverrides((current) => ({
                      ...current,
                      mode: value as BillingMode,
                    }))
                  }}
                >
                  <SelectTrigger id="billing-mode" className="h-10 w-full rounded-md border-input bg-input/20 px-3 text-sm data-[size=default]:h-10">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox</SelectItem>
                    <SelectItem value="live">Live</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="billing-enabled">Gateway Enabled</FieldLabel>
                <div className="flex items-center gap-3">
                  <Toggle
                    id="billing-enabled"
                    pressed={!!draft.enabled}
                    aria-pressed={!!draft.enabled}
                    disabled={!canManage || mutation.isPending}
                    onPressedChange={(pressed: boolean) => {
                      setFeedback(null)
                      setDraftOverrides((current) => ({
                        ...current,
                        enabled: pressed,
                      }))
                    }}
                    className="data-[state=on]:bg-green-600 data-[state=off]:bg-muted transition-colors"
                  >
                    {draft.enabled ? "Enabled" : "Disabled"}
                  </Toggle>
                  <span className="text-xs text-muted-foreground">{draft.enabled ? "Enabled" : "Disabled"}</span>
                </div>
              </Field>

              <Field>
                <FieldLabel htmlFor="billing-app-id">App ID / Client ID</FieldLabel>
                <Input
                  id="billing-app-id"
                  value={draft.app_id}
                  placeholder={editable?.app_id || "Enter app id"}
                  disabled={!canManage || mutation.isPending}
                  onChange={(event) => {
                    setFeedback(null)
                    setDraftOverrides((current) => ({
                      ...current,
                      app_id: event.target.value,
                    }))
                  }}
                />
                <FieldDescription>
                  Stored app id: {editable?.has_app_id ? "Configured" : "Not configured"}. Leave blank to keep current value.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="billing-secret">Secret / Private Key</FieldLabel>
                <Input
                  id="billing-secret"
                  type="password"
                  value={draft.secret}
                  placeholder="Enter new gateway secret"
                  disabled={!canManage || mutation.isPending}
                  onChange={(event) => {
                    setFeedback(null)
                    setDraftOverrides((current) => ({
                      ...current,
                      secret: event.target.value,
                    }))
                  }}
                />
                <FieldDescription>
                  Stored secret: {editable?.has_secret ? "Configured" : "Not configured"}. Leave blank to keep current value.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="billing-webhook-secret">Webhook Secret / Verification Key</FieldLabel>
                <Input
                  id="billing-webhook-secret"
                  type="password"
                  value={draft.webhook_secret}
                  placeholder="Enter webhook verification secret"
                  disabled={!canManage || mutation.isPending}
                  onChange={(event) => {
                    setFeedback(null)
                    setDraftOverrides((current) => ({
                      ...current,
                      webhook_secret: event.target.value,
                    }))
                  }}
                />
                <FieldDescription>
                  Stored webhook key: {editable?.has_webhook_secret ? "Configured" : "Not configured"}. Leave blank to keep current value.
                </FieldDescription>
              </Field>
            </FieldGroup>
          )}

          {selectedProviderStatus && (
            <div className="rounded-md border border-border/70 p-3 text-sm">
              <p>Provider status: {selectedProviderStatus.configured ? "Configured" : "Not configured"}</p>
              <p>Runtime mode: {selectedProviderStatus.mode}</p>
              <p>Enabled: {selectedProviderStatus.enabled ? "Yes" : "No"}</p>
            </div>
          )}

          {feedback && <p className="text-sm text-muted-foreground">{feedback}</p>}
          {!feedback && configQuery.error instanceof Error && (
            <p className="text-sm text-destructive">{configQuery.error.message}</p>
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              disabled={!canManage || mutation.isPending || !draft}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "Saving..." : "Save Billing Configuration"}
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
