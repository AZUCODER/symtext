import { NextResponse } from "next/server"
import { convertToModelMessages, jsonSchema, stepCountIs, streamText, tool } from "ai"
import type { JSONSchema7 } from "json-schema"

import { auth } from "@/auth"
import { createRuntimeModel, resolveAiRuntime } from "@/lib/ai/runtime"

export const maxDuration = 120

type BlocknoteAiRequestBody = {
  messages?: unknown
  toolDefinitions?: unknown
}

type ToolDefinitionShape = {
  description?: string
  inputSchema: unknown
  outputSchema?: unknown
}

type ToolDefinitionsShape = Record<string, ToolDefinitionShape>

type DocumentStateMetadata = {
  selection?: unknown
  selectedBlocks?: unknown
  blocks?: unknown
  isEmptyDocument?: boolean
}

type UIMessageWithMetadata = {
  id?: string
  role?: string
  parts?: unknown[]
  metadata?: {
    documentState?: DocumentStateMetadata
  }
}

const BLOCKNOTE_BASE_SYSTEM_PROMPT = [
  "You are an AI writing assistant embedded in a rich-text editor.",
  "Return concise, directly usable output for the current editing request.",
  "When asked to draft content, provide complete prose rather than planning steps.",
].join(" ")

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isToolDefinitions(value: unknown): value is ToolDefinitionsShape {
  return isPlainObject(value)
}

function injectDocumentStateMessagesServer(messages: UIMessageWithMetadata[]): UIMessageWithMetadata[] {
  return messages.flatMap((message) => {
    if (message.role !== "user") {
      return [message]
    }

    const documentState = message.metadata?.documentState
    if (!documentState) {
      return [message]
    }

    const assistantParts = documentState.selection
      ? [
          {
            type: "text",
            text: "This is the latest state of the selection (ignore previous selections, you MUST issue operations against this latest version of the selection):",
          },
          { type: "text", text: JSON.stringify(documentState.selectedBlocks) },
          {
            type: "text",
            text: "This is the latest state of the entire document (INCLUDING the selected text), you can use this to find the selected text to understand the context (but you MUST NOT issue operations against this document, you MUST issue operations against the selection):",
          },
          { type: "text", text: JSON.stringify(documentState.blocks) },
        ]
      : [
          {
            type: "text",
            text:
              "There is no active selection. This is the latest state of the document (ignore previous documents, you MUST issue operations against this latest version of the document). The cursor is BETWEEN two blocks as indicated by cursor: true. " +
              (documentState.isEmptyDocument
                ? "Because the document is empty, YOU MUST first update the empty block before adding new blocks."
                : "Prefer updating existing blocks over removing and adding (but this also depends on the user's question)."),
          },
          { type: "text", text: JSON.stringify(documentState.blocks) },
        ]

    return [
      {
        role: "assistant",
        id: `assistant-document-state-${message.id ?? "unknown"}`,
        parts: assistantParts,
      },
      message,
    ]
  })
}

function toolDefinitionsToToolSetServer(toolDefinitions: ToolDefinitionsShape) {
  return Object.fromEntries(
    Object.entries(toolDefinitions).map(([name, definition]) => [
      name,
      tool({
        description: definition.description,
        inputSchema: jsonSchema(definition.inputSchema as JSONSchema7),
        outputSchema: jsonSchema((definition.outputSchema ?? { type: "object" }) as JSONSchema7),
      }),
    ]),
  )
}

function buildSystemPrompt(overridePrompt: string | null): string {
  const defaultPrompt = BLOCKNOTE_BASE_SYSTEM_PROMPT
  const normalized = (overridePrompt ?? "").trim()
  if (!normalized) {
    return defaultPrompt
  }
  return `${normalized}\n\n${defaultPrompt}`
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.accessToken) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const runtime = await resolveAiRuntime(session.accessToken)

    const body = (await req.json().catch(() => null)) as BlocknoteAiRequestBody | null
    const messages = (Array.isArray(body?.messages) ? body.messages : []) as UIMessageWithMetadata[]
    const toolDefinitions = isToolDefinitions(body?.toolDefinitions) ? body.toolDefinitions : {}
    const tools = toolDefinitionsToToolSetServer(toolDefinitions)
    const hasTools = Object.keys(tools).length > 0

    if (!hasTools) {
      return NextResponse.json(
        { message: "Invalid BlockNote AI request: missing tool definitions" },
        { status: 400 },
      )
    }

    const modelMessages = await convertToModelMessages(injectDocumentStateMessagesServer(messages) as never)

    const commonConfig = {
      model: createRuntimeModel(runtime.runtime, runtime.config.model),
      system: buildSystemPrompt(runtime.config.system_prompt),
      messages: modelMessages,
      temperature: runtime.config.temperature,
      maxOutputTokens: runtime.config.max_tokens,
    } as const

    const result = streamText({
      ...commonConfig,
      tools,
      toolChoice: "required",
      stopWhen: stepCountIs(1),
      timeout: 90_000,
    })
    return result.toUIMessageStreamResponse()
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process BlockNote AI request"
    console.error("[blocknote-ai] request failed", error)
    return NextResponse.json({ message }, { status: 500 })
  }
}
