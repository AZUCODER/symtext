"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { getCloudOssConfig, updateCloudOssConfig } from "@/lib/cloud-oss-config-client"
import type { CloudOssProvider } from "@/lib/dashboard-types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const PROVIDER_LABELS: Record<CloudOssProvider, string> = {
  aliyunoss: "Aliyun OSS",
  huaweioss: "Huawei OSS",
  awsoss: "AWS OSS",
}

const QUERY_KEY = ["cloud-oss-config"] as const

type OssFormDraft = {
  endpoint: string
  bucket_name: string
  public_base_url: string
  access_key_id: string
  access_key_secret: string
}

const EMPTY_DRAFT: OssFormDraft = {
  endpoint: "",
  bucket_name: "",
  public_base_url: "",
  access_key_id: "",
  access_key_secret: "",
}

const EMPTY_DRAFTS: Record<CloudOssProvider, OssFormDraft> = {
  aliyunoss: { ...EMPTY_DRAFT },
  huaweioss: { ...EMPTY_DRAFT },
  awsoss: { ...EMPTY_DRAFT },
}

export function CloudOssConfiguration({ currentUserRole }: { currentUserRole: "viewer" | "editor" | "admin" }) {
  const queryClient = useQueryClient()
  const [selectedProviderOverride, setSelectedProviderOverride] = useState<CloudOssProvider | null>(null)
  const [draftByProvider, setDraftByProvider] = useState<Partial<Record<CloudOssProvider, OssFormDraft>>>(
    EMPTY_DRAFTS,
  )
  const [feedback, setFeedback] = useState<string | null>(null)

  const configQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getCloudOssConfig,
    staleTime: 30_000,
  })

  const selectedProvider = selectedProviderOverride ?? configQuery.data?.selected_provider ?? "aliyunoss"

  const canManage = currentUserRole === "admin"

  const saveMutation = useMutation({
    mutationFn: () => {
      const draft = draftByProvider[selectedProvider] ?? initialDraftForSelectedProvider
      return updateCloudOssConfig({
        selected_provider: selectedProvider,
        endpoint: draft.endpoint,
        bucket_name: draft.bucket_name,
        public_base_url: draft.public_base_url,
        ...(draft.access_key_id.trim() ? { access_key_id: draft.access_key_id.trim() } : {}),
        ...(draft.access_key_secret.trim() ? { access_key_secret: draft.access_key_secret.trim() } : {}),
      })
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEY, updated)
      setFeedback(`Cloud OSS settings saved for ${PROVIDER_LABELS[updated.selected_provider]}.`)
      setSelectedProviderOverride(null)
      setDraftByProvider((current) => ({
        ...current,
        [updated.selected_provider]: {
          endpoint: updated.editable.endpoint,
          bucket_name: updated.editable.bucket_name,
          public_base_url: updated.editable.public_base_url,
          access_key_id: "",
          access_key_secret: "",
        },
      }))
    },
    onError: (error) => {
      setFeedback(error instanceof Error ? error.message : "Failed to update cloud OSS configuration")
    },
  })

  const selectedStatus = useMemo(() => {
    if (!configQuery.data) {
      return null
    }
    return configQuery.data.providers.find((item) => item.provider === selectedProvider) ?? null
  }, [configQuery.data, selectedProvider])

  const initialDraftForSelectedProvider = useMemo<OssFormDraft>(() => {
    if (configQuery.data?.selected_provider === selectedProvider) {
      return {
        endpoint: configQuery.data.editable.endpoint,
        bucket_name: configQuery.data.editable.bucket_name,
        public_base_url: configQuery.data.editable.public_base_url,
        access_key_id: "",
        access_key_secret: "",
      }
    }

    return EMPTY_DRAFT
  }, [configQuery.data, selectedProvider])

  const currentDraft = draftByProvider[selectedProvider] ?? initialDraftForSelectedProvider

  const updateField = (field: keyof OssFormDraft, value: string) => {
    setFeedback(null)
    setDraftByProvider((current) => ({
      ...current,
      [selectedProvider]: {
        ...(current[selectedProvider] ?? initialDraftForSelectedProvider),
        [field]: value,
      },
    }))
  }

  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Cloud OSS Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {configQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading cloud OSS configuration...</p>
          ) : (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="cloud-oss-provider">Active OSS Provider</FieldLabel>
                <Select
                  value={selectedProvider}
                  onValueChange={(value) => {
                    setFeedback(null)
                    setSelectedProviderOverride(value as CloudOssProvider)
                  }}
                  disabled={!canManage || saveMutation.isPending}
                >
                  <SelectTrigger id="cloud-oss-provider" className="h-10 w-full rounded-md border-input bg-input/20 px-3 text-sm data-[size=default]:h-10">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aliyunoss">Aliyun OSS</SelectItem>
                    <SelectItem value="huaweioss">Huawei OSS</SelectItem>
                    <SelectItem value="awsoss">AWS OSS</SelectItem>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Admin can switch provider and configure runtime credentials for media uploads.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="oss-endpoint">OSS Endpoint / Region</FieldLabel>
                <Input
                  id="oss-endpoint"
                  value={currentDraft.endpoint}
                  onChange={(event) => updateField("endpoint", event.target.value)}
                  placeholder="oss-cn-chengdu.aliyuncs.com"
                  disabled={!canManage || saveMutation.isPending}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="oss-bucket-name">OSS Bucket Name</FieldLabel>
                <Input
                  id="oss-bucket-name"
                  value={currentDraft.bucket_name}
                  onChange={(event) => updateField("bucket_name", event.target.value)}
                  placeholder="symtext"
                  disabled={!canManage || saveMutation.isPending}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="oss-access-key-id">Access Key ID</FieldLabel>
                <Input
                  id="oss-access-key-id"
                  value={currentDraft.access_key_id}
                  onChange={(event) => updateField("access_key_id", event.target.value)}
                  placeholder={configQuery.data?.editable.access_key_id || "Enter new access key id"}
                  disabled={!canManage || saveMutation.isPending}
                />
                <FieldDescription>
                  Stored key: {configQuery.data?.editable.has_access_key_id ? "Configured" : "Not configured"}. Leave blank to keep current key.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="oss-access-key-secret">Access Key Secret</FieldLabel>
                <Input
                  id="oss-access-key-secret"
                  type="password"
                  value={currentDraft.access_key_secret}
                  onChange={(event) => updateField("access_key_secret", event.target.value)}
                  placeholder="Enter new access key secret"
                  disabled={!canManage || saveMutation.isPending}
                />
                <FieldDescription>
                  Stored secret: {configQuery.data?.editable.has_access_key_secret ? "Configured" : "Not configured"}. Leave blank to keep current secret.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="oss-public-base-url">Public Base URL</FieldLabel>
                <Input
                  id="oss-public-base-url"
                  value={currentDraft.public_base_url}
                  onChange={(event) => updateField("public_base_url", event.target.value)}
                  placeholder="https://symtext.oss-cn-chengdu.aliyuncs.com"
                  disabled={!canManage || saveMutation.isPending}
                />
              </Field>
            </FieldGroup>
          )}

          {selectedStatus && (
            <div className="rounded-md border border-border/70 p-3 text-sm">
              <p>Provider status: {selectedStatus.configured ? "Configured" : "Not configured"}</p>
              <p>Signed upload support: {selectedStatus.supports_signed_upload ? "Available" : "Not implemented"}</p>
            </div>
          )}

          {feedback && <p className="text-sm text-muted-foreground">{feedback}</p>}
          {!feedback && configQuery.error instanceof Error && (
            <p className="text-sm text-destructive">{configQuery.error.message}</p>
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              disabled={!canManage || saveMutation.isPending || configQuery.isLoading}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? "Saving..." : "Save Cloud OSS Configuration"}
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
