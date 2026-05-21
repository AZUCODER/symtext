import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { API_BASE_URL } from "@/app/api/_lib/auth"
import { extractApiErrorMessage } from "@/app/api/_lib/error-message"
import { withBearerHeaders } from "@/lib/http"

type Params = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const upstream = await fetch(`${API_BASE_URL}/blog/${id}/archive`, {
    method: "POST",
    headers: withBearerHeaders(session.accessToken),
    cache: "no-store",
  })
  const payload = await upstream.json().catch(() => null)

  return NextResponse.json(
    upstream.ok ? payload : { message: extractApiErrorMessage(payload, "Failed to archive post") },
    { status: upstream.status }
  )
}
