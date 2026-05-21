import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { API_BASE_URL } from "@/app/api/_lib/auth"
import { extractApiErrorMessage } from "@/app/api/_lib/error-message"
import { withBearerHeaders, withJsonHeaders } from "@/lib/http"

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const upstream = await fetch(`${API_BASE_URL}/blog/${id}/publish`, {
    method: "POST",
    headers: withJsonHeaders(withBearerHeaders(session.accessToken)),
    body: JSON.stringify(body),
    cache: "no-store",
  })
  const payload = await upstream.json().catch(() => null)

  return NextResponse.json(
    upstream.ok ? payload : { message: extractApiErrorMessage(payload, "Failed to publish post") },
    { status: upstream.status }
  )
}
