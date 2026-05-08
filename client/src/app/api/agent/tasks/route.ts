import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { API_BASE_URL } from "@/app/api/_lib/auth"

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const upstream = await fetch(`${API_BASE_URL}/agent/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
  })

  const payload = await upstream.json().catch(() => null)
  return NextResponse.json(
    upstream.ok ? payload : { message: payload?.detail ?? "Failed to create task" },
    { status: upstream.status }
  )
}
