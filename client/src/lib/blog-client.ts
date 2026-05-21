import type {
  BlogCreatePayload,
  BlogListResponse,
  BlogPost,
  BlogUpdatePayload,
} from "@/lib/dashboard-types"
import { withJsonHeaders } from "@/lib/http"

export type BlogDraftGeneratePayload = {
  prompt: string
  locale?: string
  action?: "generate" | "summarize" | "rewrite" | "categorize"
}

export type BlogDraftSuggestion = {
  title: string
  excerpt: string
  content_markdown: string
  seo_title: string
  seo_description: string
  keywords: string[]
  category: string
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { ...init, cache: "no-store" })
  const payload = (await response.json().catch(() => null)) as (T & { message?: unknown }) | null

  if (!response.ok) {
    const rawMessage = payload?.message
    if (typeof rawMessage === "string" && rawMessage.trim().length > 0) {
      throw new Error(rawMessage)
    }

    if (Array.isArray(rawMessage)) {
      throw new Error(rawMessage.map((item) => String(item)).join("; "))
    }

    if (rawMessage !== undefined && rawMessage !== null) {
      throw new Error(JSON.stringify(rawMessage))
    }

    throw new Error(`Request failed: ${response.status}`)
  }

  return (payload ?? {}) as T
}

export async function getBlogPosts(params?: {
  page?: number
  page_size?: number
  status?: string
  include_deleted?: boolean
}): Promise<BlogListResponse> {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set("page", String(params.page))
  if (params?.page_size) searchParams.set("page_size", String(params.page_size))
  if (params?.status) searchParams.set("status", params.status)
  if (params?.include_deleted) searchParams.set("include_deleted", "true")

  const qs = searchParams.toString()
  return requestJson<BlogListResponse>(`/api/blog${qs ? `?${qs}` : ""}`)
}

export async function getBlogPost(id: string): Promise<BlogPost> {
  return requestJson<BlogPost>(`/api/blog/${id}`)
}

export async function createBlogPost(payload: BlogCreatePayload): Promise<BlogPost> {
  return requestJson<BlogPost>("/api/blog", {
    method: "POST",
    headers: withJsonHeaders(),
    body: JSON.stringify(payload),
  })
}

export async function updateBlogPost(id: string, payload: BlogUpdatePayload): Promise<BlogPost> {
  return requestJson<BlogPost>(`/api/blog/${id}`, {
    method: "PATCH",
    headers: withJsonHeaders(),
    body: JSON.stringify(payload),
  })
}

export async function publishBlogPost(id: string): Promise<BlogPost> {
  return requestJson<BlogPost>(`/api/blog/${id}/publish`, {
    method: "POST",
    headers: withJsonHeaders(),
    body: JSON.stringify({}),
  })
}

export async function archiveBlogPost(id: string): Promise<BlogPost> {
  return requestJson<BlogPost>(`/api/blog/${id}/archive`, {
    method: "POST",
    headers: {},
  })
}

export async function deleteBlogPost(id: string): Promise<BlogPost> {
  return requestJson<BlogPost>(`/api/blog/${id}`, {
    method: "DELETE",
    headers: {},
  })
}

export async function generateBlogDraft(payload: BlogDraftGeneratePayload): Promise<BlogDraftSuggestion> {
  return requestJson<BlogDraftSuggestion>("/api/agent/blog-draft", {
    method: "POST",
    headers: withJsonHeaders(),
    body: JSON.stringify(payload),
  })
}
