import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { API_BASE_URL } from "@/app/api/_lib/auth"

type Params = {
  params: Promise<{ taskId: string }>
}

export async function GET(_request: Request, context: Params) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { taskId } = await context.params
  const upstream = await fetch(`${API_BASE_URL}/agent/tasks/${taskId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: "no-store",
  })

  const payload = await upstream.json().catch(() => null)
  return NextResponse.json(
    upstream.ok ? payload : { message: payload?.detail ?? "Failed to fetch task" },
    { status: upstream.status }
  )
}
