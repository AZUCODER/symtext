import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { runContentAgent, type ContentAgentAction } from "@/lib/ai/content-agent"
import { resolveAiRuntime } from "@/lib/ai/runtime"
import { setAgentTask } from "@/lib/agent-task-store"

type CreateTaskBody = {
  action?: ContentAgentAction
  content?: string
  locale?: string
}

function isAction(value: unknown): value is ContentAgentAction {
  return value === "generate" || value === "summarize" || value === "rewrite" || value === "categorize"
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as CreateTaskBody | null
  const action = body?.action
  const content = body?.content?.trim() ?? ""
  const locale = body?.locale?.trim() || "en"

  if (!isAction(action)) {
    return NextResponse.json({ message: "Invalid action" }, { status: 400 })
  }

  if (!content) {
    return NextResponse.json({ message: "Content is required" }, { status: 400 })
  }

  const taskId = crypto.randomUUID()
  const createdAt = new Date().toISOString()

  setAgentTask({
    task_id: taskId,
    status: "running",
    action,
    created_at: createdAt,
  })

  try {
    const runtime = await resolveAiRuntime(session.accessToken)
    const result = await runContentAgent(runtime, {
      action,
      content,
      locale,
    })

    const completedTask = setAgentTask({
      task_id: taskId,
      status: "completed",
      action,
      created_at: createdAt,
      result,
    })

    return NextResponse.json(completedTask, { status: 202 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create task"
    const failedTask = setAgentTask({
      task_id: taskId,
      status: "failed",
      action,
      created_at: createdAt,
      error: message,
    })
    return NextResponse.json(failedTask, { status: 500 })
  }
}
