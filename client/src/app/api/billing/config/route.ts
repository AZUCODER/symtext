import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { API_BASE_URL } from "@/app/api/_lib/auth"
import { withBearerHeaders, withJsonHeaders } from "@/lib/http"

export async function GET() {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const upstream = await fetch(`${API_BASE_URL}/billing/config`, {
    method: "GET",
    headers: withBearerHeaders(session.accessToken),
    cache: "no-store",
  })
  const payload = await upstream.json().catch(() => null)

  return NextResponse.json(
    upstream.ok ? payload : { message: payload?.detail ?? "Failed to load billing config" },
    { status: upstream.status },
  )
}

export async function PUT(request: Request) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const upstream = await fetch(`${API_BASE_URL}/billing/config`, {
    method: "PUT",
    headers: withJsonHeaders(withBearerHeaders(session.accessToken)),
    body: JSON.stringify(body),
    cache: "no-store",
  })
  const payload = await upstream.json().catch(() => null)

  return NextResponse.json(
    upstream.ok ? payload : { message: payload?.detail ?? "Failed to update billing config" },
    { status: upstream.status },
  )
}
