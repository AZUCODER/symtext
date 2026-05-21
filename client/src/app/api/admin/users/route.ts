import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { API_BASE_URL } from "@/app/api/_lib/auth"
import type { AdminCreateUserPayload, UserRole } from "@/lib/dashboard-types"
import { withBearerHeaders, withJsonHeaders } from "@/lib/http"

type RolePayload = {
  email?: string
  role?: UserRole
}

type CreatePayload = AdminCreateUserPayload

async function requestUsers(token: string): Promise<Response> {
  return fetch(`${API_BASE_URL}/auth/users`, {
    method: "GET",
    headers: withBearerHeaders(token),
    cache: "no-store",
  })
}

async function requestRoleUpdate(token: string, payload: RolePayload): Promise<Response> {
  return fetch(`${API_BASE_URL}/auth/users/role`, {
    method: "PATCH",
    headers: withJsonHeaders(withBearerHeaders(token)),
    body: JSON.stringify(payload),
    cache: "no-store",
  })
}

async function requestCreateUser(token: string, payload: CreatePayload): Promise<Response> {
  return fetch(`${API_BASE_URL}/auth/users`, {
    method: "POST",
    headers: withJsonHeaders(withBearerHeaders(token)),
    body: JSON.stringify(payload),
    cache: "no-store",
  })
}

export async function GET() {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const upstream = await requestUsers(session.accessToken)
  const payload = await upstream.json().catch(() => null)

  return NextResponse.json(
    upstream.ok ? payload : { message: payload?.detail ?? "Failed to load users" },
    { status: upstream.status }
  )
}

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as RolePayload
  const upstream = await requestRoleUpdate(session.accessToken, body)
  const payload = await upstream.json().catch(() => null)

  return NextResponse.json(
    upstream.ok ? payload : { message: payload?.detail ?? "Failed to update role" },
    { status: upstream.status }
  )
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as CreatePayload
  const upstream = await requestCreateUser(session.accessToken, body)
  const payload = await upstream.json().catch(() => null)

  return NextResponse.json(
    upstream.ok ? payload : { message: payload?.detail ?? "Failed to create user" },
    { status: upstream.status }
  )
}
