import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { API_BASE_URL } from "@/app/api/_lib/auth"
import type { AdminUpdateUserPayload } from "@/lib/dashboard-types"
import { withBearerHeaders, withJsonHeaders } from "@/lib/http"

type Params = { params: Promise<{ email: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as AdminUpdateUserPayload
  const { email } = await params
  const upstream = await fetch(`${API_BASE_URL}/auth/users/${encodeURIComponent(email)}`, {
    method: "PATCH",
    headers: withJsonHeaders(withBearerHeaders(session.accessToken)),
    body: JSON.stringify(body),
    cache: "no-store",
  })
  const payload = await upstream.json().catch(() => null)

  return NextResponse.json(
    upstream.ok ? payload : { message: payload?.detail ?? "Failed to update user" },
    { status: upstream.status }
  )
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { email } = await params
  const upstream = await fetch(`${API_BASE_URL}/auth/users/${encodeURIComponent(email)}`, {
    method: "DELETE",
    headers: withBearerHeaders(session.accessToken),
    cache: "no-store",
  })
  const payload = await upstream.json().catch(() => null)

  return NextResponse.json(
    upstream.ok ? payload : { message: payload?.detail ?? "Failed to delete user" },
    { status: upstream.status }
  )
}
