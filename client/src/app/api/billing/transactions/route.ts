import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { API_BASE_URL } from "@/app/api/_lib/auth"
import { withBearerHeaders } from "@/lib/http"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const query = url.searchParams.toString()
  const upstream = await fetch(`${API_BASE_URL}/billing/transactions${query ? `?${query}` : ""}`, {
    method: "GET",
    headers: withBearerHeaders(session.accessToken),
    cache: "no-store",
  })
  const payload = await upstream.json().catch(() => null)

  return NextResponse.json(
    upstream.ok ? payload : { message: payload?.detail ?? "Failed to load billing transactions" },
    { status: upstream.status },
  )
}
