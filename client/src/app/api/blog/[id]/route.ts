import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { API_BASE_URL } from "@/app/api/_lib/auth"
import { extractApiErrorMessage } from "@/app/api/_lib/error-message"
import { withBearerHeaders, withJsonHeaders } from "@/lib/http"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const upstream = await fetch(`${API_BASE_URL}/blog/${id}`, {
    method: "GET",
    headers: withBearerHeaders(session.accessToken),
    cache: "no-store",
  })
  const payload = await upstream.json().catch(() => null)

  return NextResponse.json(
    upstream.ok ? payload : { message: extractApiErrorMessage(payload, "Post not found") },
    { status: upstream.status }
  )
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const upstream = await fetch(`${API_BASE_URL}/blog/${id}`, {
    method: "PATCH",
    headers: withJsonHeaders(withBearerHeaders(session.accessToken)),
    body: JSON.stringify(body),
    cache: "no-store",
  })
  const payload = await upstream.json().catch(() => null)

  return NextResponse.json(
    upstream.ok ? payload : { message: extractApiErrorMessage(payload, "Failed to update post") },
    { status: upstream.status }
  )
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const upstream = await fetch(`${API_BASE_URL}/blog/${id}`, {
    method: "DELETE",
    headers: withBearerHeaders(session.accessToken),
    cache: "no-store",
  })
  const payload = await upstream.json().catch(() => null)

  return NextResponse.json(
    upstream.ok ? payload : { message: extractApiErrorMessage(payload, "Failed to delete post") },
    { status: upstream.status }
  )
}
