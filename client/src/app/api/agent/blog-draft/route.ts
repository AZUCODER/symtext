import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { runContentAgent, type ContentAgentAction } from "@/lib/ai/content-agent"
import { resolveAiRuntime } from "@/lib/ai/runtime"

type BlogDraftRequestBody = {
  prompt?: string
  locale?: string
  action?: ContentAgentAction
}

type BlogDraftResponse = {
  title: string
  excerpt: string
  content_markdown: string
  seo_title: string
  seo_description: string
  keywords: string[]
  category: string
}

function isAction(value: unknown): value is ContentAgentAction {
  return value === "generate" || value === "summarize" || value === "rewrite" || value === "categorize"
}

function toExcerpt(summary: string): string {
  return summary.trim().slice(0, 320)
}

function isRuntimeDebugEnabled(): boolean {
  return process.env.AI_RUNTIME_DEBUG === "1" || process.env.AI_RUNTIME_DEBUG === "true"
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as BlogDraftRequestBody | null
  const prompt = body?.prompt?.trim() ?? ""
  const locale = body?.locale?.trim() || "en"

  if (!prompt) {
    return NextResponse.json({ message: "Prompt is required" }, { status: 400 })
  }

  const requestedAction = body?.action
  const action: ContentAgentAction = isAction(requestedAction) ? requestedAction : "generate"

  try {
    const runtime = await resolveAiRuntime(session.accessToken)
    const debugEnabled = isRuntimeDebugEnabled()
    if (debugEnabled) {
      console.info("[ai-runtime][blog-draft]", {
        requestedProvider: runtime.requestedProvider,
        activeProvider: runtime.activeProvider,
        fallbackApplied: runtime.fallbackApplied,
        runtimeProvider: runtime.config.runtime.provider,
        providerStatuses: runtime.config.providers,
        model: runtime.config.model,
      })
    }

    const result = await runContentAgent(runtime, {
      action,
      content: prompt,
      locale,
    })

    const payload: BlogDraftResponse = {
      title: result.title,
      excerpt: toExcerpt(result.summary),
      content_markdown: result.markdown,
      seo_title: result.seo_title,
      seo_description: result.seo_description,
      keywords: result.keywords,
      category: result.category,
    }

    return NextResponse.json(payload, {
      headers: {
        "x-ai-provider-requested": runtime.requestedProvider,
        "x-ai-provider-active": runtime.activeProvider,
        "x-ai-provider-fallback": runtime.fallbackApplied ? "1" : "0",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate blog draft"
    return NextResponse.json({ message }, { status: 500 })
  }
}
