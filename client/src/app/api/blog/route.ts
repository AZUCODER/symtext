import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { API_BASE_URL } from "@/app/api/_lib/auth"
import { extractApiErrorMessage } from "@/app/api/_lib/error-message"
import { withBearerHeaders, withJsonHeaders } from "@/lib/http"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const upstream = await fetch(`${API_BASE_URL}/blog?${searchParams.toString()}`, {
    method: "GET",
    headers: withBearerHeaders(session.accessToken),
    cache: "no-store",
  })
  const payload = await upstream.json().catch(() => null)

  return NextResponse.json(
    upstream.ok ? payload : { message: extractApiErrorMessage(payload, "Failed to load posts") },
    { status: upstream.status }
  )
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const upstream = await fetch(`${API_BASE_URL}/blog`, {
    method: "POST",
    headers: withJsonHeaders(withBearerHeaders(session.accessToken)),
    body: JSON.stringify(body),
    cache: "no-store",
  })
  const payload = await upstream.json().catch(() => null)

  return NextResponse.json(
    upstream.ok ? payload : { message: extractApiErrorMessage(payload, "Failed to create post") },
    { status: upstream.status }
  )
}
