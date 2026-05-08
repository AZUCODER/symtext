import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { API_BASE_URL } from "@/app/api/_lib/auth"
import { withBearerHeaders } from "@/lib/http"

async function requestAudit(token: string, limit: number): Promise<Response> {
  return fetch(`${API_BASE_URL}/auth/users/role-audit?limit=${limit}`, {
    method: "GET",
    headers: withBearerHeaders(token),
    cache: "no-store",
  })
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const limitParam = Number(url.searchParams.get("limit") ?? "20")
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 20

  const upstream = await requestAudit(session.accessToken, limit)
  const payload = await upstream.json().catch(() => null)

  return NextResponse.json(
    upstream.ok ? payload : { message: payload?.detail ?? "Failed to load role audit" },
    { status: upstream.status }
  )
}
