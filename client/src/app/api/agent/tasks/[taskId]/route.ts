import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { getAgentTask } from "@/lib/agent-task-store"

type Params = {
  params: Promise<{ taskId: string }>
}

export async function GET(_request: Request, context: Params) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { taskId } = await context.params
  const task = getAgentTask(taskId)
  if (!task) {
    return NextResponse.json({ message: "Task not found" }, { status: 404 })
  }

  return NextResponse.json(task)
}
