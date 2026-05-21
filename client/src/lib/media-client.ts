import { withJsonHeaders } from "@/lib/http"

type OssSignUploadPayload = {
  filename: string
  content_type?: string
  media_type: "image" | "video" | "audio" | "file"
  folder?: string
}

type OssSignUploadResponse = {
  method: "PUT"
  upload_url: string
  object_key: string
  public_url: string
  expires_in_seconds: number
  max_upload_bytes: number
  headers: Record<string, string>
}

type ErrorPayload = {
  message?: string
}

function isHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://")
}

export function toAbsoluteHttpUrl(value: string, baseUrl?: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    return ""
  }

  if (isHttpUrl(trimmed)) {
    return trimmed
  }

  if (!trimmed.startsWith("/")) {
    return trimmed
  }

  const base =
    (baseUrl && isHttpUrl(baseUrl) ? baseUrl : undefined) ??
    (typeof window !== "undefined" && window.location?.origin ? window.location.origin : undefined)

  if (!base) {
    return trimmed
  }

  return new URL(trimmed, base).toString()
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    cache: "no-store",
  })
  const payload = (await response.json().catch(() => null)) as (T & ErrorPayload) | null

  if (!response.ok) {
    throw new Error(payload?.message ?? `Request failed: ${response.status}`)
  }

  return (payload ?? {}) as T
}

export async function getOssSignedUpload(payload: OssSignUploadPayload): Promise<OssSignUploadResponse> {
  return requestJson<OssSignUploadResponse>("/api/media/oss/sign-upload", {
    method: "POST",
    headers: withJsonHeaders(),
    body: JSON.stringify(payload),
  })
}

export async function uploadFileToOss(params: {
  file: File
  mediaType: "image" | "video" | "audio" | "file"
  folder?: string
}): Promise<{ objectKey: string; publicUrl: string }> {
  const signed = await getOssSignedUpload({
    filename: params.file.name,
    content_type: params.file.type || "application/octet-stream",
    media_type: params.mediaType,
    folder: params.folder,
  })

  if (params.file.size > signed.max_upload_bytes) {
    throw new Error(`File is too large. Max size is ${Math.floor(signed.max_upload_bytes / 1024 / 1024)}MB.`)
  }

  const uploadResponse = await fetch(signed.upload_url, {
    method: signed.method,
    headers: signed.headers,
    body: params.file,
  })

  if (!uploadResponse.ok) {
    throw new Error("Failed to upload file to Alibaba Cloud OSS")
  }

  const signedReadProxyPath = `/api/media/oss/object?key=${encodeURIComponent(signed.object_key)}`
  const normalizedProxyUrl = toAbsoluteHttpUrl(signedReadProxyPath)

  return {
    objectKey: signed.object_key,
    publicUrl: isHttpUrl(normalizedProxyUrl) ? normalizedProxyUrl : signed.public_url,
  }
}
