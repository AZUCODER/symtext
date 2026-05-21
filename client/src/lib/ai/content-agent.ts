import { generateText, tool } from "ai"
import { z } from "zod"

import { createRuntimeModel, type ResolvedAiRuntime } from "@/lib/ai/runtime"

export type ContentAgentAction = "generate" | "summarize" | "rewrite" | "categorize"

export type ContentAgentInput = {
  action: ContentAgentAction
  content: string
  locale?: string
}

export type ContentAgentResult = {
  title: string
  markdown: string
  summary: string
  keywords: string[]
  category: string
  seo_title: string
  seo_description: string
}

type AgentDraftShape = {
  title?: unknown
  markdown?: unknown
  summary?: unknown
  keywords?: unknown
  category?: unknown
  seo_title?: unknown
  seo_description?: unknown
}

function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9-]/g, "")
}

function extractKeywordsFromText(text: string, limit = 8): string[] {
  const stopWords = new Set([
    "the", "and", "for", "with", "from", "this", "that", "your", "into", "about", "there", "their",
    "were", "have", "has", "will", "would", "should", "could", "can", "you", "our", "are", "is", "to",
    "in", "on", "at", "of", "by", "as", "or", "a", "an", "be", "it", "we", "they", "them", "if",
  ])

  const scores = new Map<string, number>()
  for (const token of text.split(/\s+/)) {
    const normalized = normalizeWord(token)
    if (!normalized || normalized.length < 3 || stopWords.has(normalized)) {
      continue
    }
    scores.set(normalized, (scores.get(normalized) ?? 0) + 1)
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word)
}

function classifyCategory(text: string): string {
  const content = text.toLowerCase()

  if (/ai|agent|llm|model|prompt|automation/.test(content)) return "AI"
  if (/seo|content|copywriting|blog|marketing/.test(content)) return "Marketing"
  if (/next\.js|react|typescript|api|backend|frontend|database/.test(content)) return "Engineering"
  if (/product|roadmap|feature|user|feedback/.test(content)) return "Product"

  return "General"
}

function buildActionPrompt(input: ContentAgentInput): string {
  const locale = input.locale?.trim() || "en"

  if (input.action === "generate") {
    return `Create a high-quality blog draft in locale ${locale} based on this instruction: ${input.content}`
  }

  if (input.action === "summarize") {
    return `Summarize this content for CMS editors in locale ${locale}: ${input.content}`
  }

  if (input.action === "rewrite") {
    return `Rewrite this content to improve clarity, flow, and SEO in locale ${locale}: ${input.content}`
  }

  return `Categorize and enrich this content for CMS workflows in locale ${locale}: ${input.content}`
}

function buildSystemPrompt(baseSystemPrompt: string | null): string {
  const fallback = [
    "You are a senior content operations agent for a CMS.",
    "Always produce valid JSON and no markdown fences.",
    "Your output must fit the schema with fields:",
    "title, markdown, summary, keywords, category, seo_title, seo_description.",
  ].join(" ")

  const normalized = (baseSystemPrompt ?? "").trim()
  return normalized ? `${normalized}\n\n${fallback}` : fallback
}

function summarizeText(text: string, maxLength = 280): string {
  const compact = text.replace(/\s+/g, " ").trim()
  if (compact.length <= maxLength) {
    return compact
  }
  return `${compact.slice(0, maxLength).trimEnd()}...`
}

function fallbackTitle(text: string): string {
  const firstMeaningfulLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0)

  if (!firstMeaningfulLine) {
    return "Untitled Draft"
  }

  const trimmed = firstMeaningfulLine.replace(/^#+\s*/, "")
  return trimmed.length > 80 ? `${trimmed.slice(0, 80).trimEnd()}...` : trimmed
}

function normalizeRawResponse(text: string): string {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim()
}

function parseDraftShape(raw: string): AgentDraftShape | null {
  try {
    return JSON.parse(raw) as AgentDraftShape
  } catch {
    const start = raw.indexOf("{")
    const end = raw.lastIndexOf("}")
    if (start === -1 || end === -1 || end <= start) {
      return null
    }

    const candidate = raw.slice(start, end + 1)
    try {
      return JSON.parse(candidate) as AgentDraftShape
    } catch {
      return null
    }
  }
}

function parseResult(text: string): ContentAgentResult {
  const normalized = normalizeRawResponse(text)
  const parsed = parseDraftShape(normalized)

  if (!parsed) {
    const fallbackMarkdown = normalized.length > 0 ? normalized : text
    const summary = summarizeText(fallbackMarkdown)

    return {
      title: fallbackTitle(fallbackMarkdown),
      markdown: fallbackMarkdown,
      summary,
      keywords: extractKeywordsFromText(fallbackMarkdown, 8),
      category: classifyCategory(fallbackMarkdown),
      seo_title: fallbackTitle(fallbackMarkdown),
      seo_description: summarizeText(summary, 160),
    }
  }

  const keywords = Array.isArray(parsed.keywords)
    ? parsed.keywords.filter((item): item is string => typeof item === "string").slice(0, 12)
    : []

  const markdown = typeof parsed.markdown === "string" && parsed.markdown.trim().length > 0
    ? parsed.markdown
    : normalized
  const summary = typeof parsed.summary === "string" && parsed.summary.trim().length > 0
    ? parsed.summary
    : summarizeText(markdown)
  const title = typeof parsed.title === "string" && parsed.title.trim().length > 0
    ? parsed.title
    : fallbackTitle(markdown)

  return {
    title,
    markdown,
    summary,
    keywords: keywords.length > 0 ? keywords : extractKeywordsFromText(markdown, 8),
    category: typeof parsed.category === "string" ? parsed.category : "General",
    seo_title: typeof parsed.seo_title === "string" && parsed.seo_title.trim().length > 0 ? parsed.seo_title : title,
    seo_description:
      typeof parsed.seo_description === "string" && parsed.seo_description.trim().length > 0
        ? parsed.seo_description
        : summarizeText(summary, 160),
  }
}

function isPlanningLikeResponse(text: string): boolean {
  const normalized = text.trim().toLowerCase()
  return /^(let me|i will|first,?\s*i('| a)?ll|sure,?\s*i('| a)?ll)/.test(normalized)
}

function shouldRetryDraft(result: ContentAgentResult, rawText: string, action: ContentAgentAction): boolean {
  if (action !== "generate" && action !== "rewrite") {
    return false
  }

  if (isPlanningLikeResponse(rawText)) {
    return true
  }

  return result.markdown.trim().length < 120
}

export async function runContentAgent(runtime: ResolvedAiRuntime, input: ContentAgentInput): Promise<ContentAgentResult> {
  const model = createRuntimeModel(runtime.runtime, runtime.config.model)

  const keywordTool = tool({
    description: "Extract SEO keywords from content using deterministic scoring.",
    inputSchema: z.object({
      text: z.string(),
      limit: z.number().int().min(3).max(20).default(8),
    }),
    execute: async ({ text, limit }) => ({
      keywords: extractKeywordsFromText(text, limit),
    }),
  })

  const categoryTool = tool({
    description: "Classify content into a stable CMS category.",
    inputSchema: z.object({
      text: z.string(),
    }),
    execute: async ({ text }) => ({
      category: classifyCategory(text),
    }),
  })

  const { text } = await generateText({
    model,
    system: buildSystemPrompt(runtime.config.system_prompt),
    prompt: [
      buildActionPrompt(input),
      "Return JSON only.",
      "Required JSON schema:",
      '{"title":"...","markdown":"...","summary":"...","keywords":["..."],"category":"...","seo_title":"...","seo_description":"..."}',
    ].join("\n"),
    temperature: runtime.config.temperature,
    maxOutputTokens: runtime.config.max_tokens,
    tools: {
      extractKeywords: keywordTool,
      classifyCategory: categoryTool,
    },
  })

  const initialResult = parseResult(text)
  if (!shouldRetryDraft(initialResult, text, input.action)) {
    return initialResult
  }

  const { text: retryText } = await generateText({
    model,
    system: buildSystemPrompt(runtime.config.system_prompt),
    prompt: [
      `Write a complete ${input.locale?.trim() || "en"} blog draft now for this topic: ${input.content}`,
      "Do not describe a plan.",
      "Do not say what you will do.",
      "Output final content only as valid JSON.",
      "Required JSON schema:",
      '{"title":"...","markdown":"...","summary":"...","keywords":["..."],"category":"...","seo_title":"...","seo_description":"..."}',
    ].join("\n"),
    temperature: runtime.config.temperature,
    maxOutputTokens: runtime.config.max_tokens,
  })

  return parseResult(retryText)
}
