import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { API_BASE_URL } from "@/lib/config"
import { withBearerHeaders, withJsonHeaders } from "@/lib/http"

function getErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "detail" in payload) {
    return String((payload as { detail?: unknown }).detail ?? fallback)
  }
  if (payload && typeof payload === "object" && "message" in payload) {
    return String((payload as { message?: unknown }).message ?? fallback)
  }
  return fallback
}

export async function GET() {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const upstream = await fetch(`${API_BASE_URL}/ai/config`, {
    method: "GET",
    headers: withBearerHeaders(session.accessToken),
    cache: "no-store",
  })

  const payload = await upstream.json().catch(() => null)
  if (!upstream.ok) {
    return NextResponse.json(
      { message: getErrorMessage(payload, "Failed to fetch AI LLM configuration") },
      { status: upstream.status },
    )
  }

  return NextResponse.json(payload)
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ message: "Invalid request payload" }, { status: 400 })
  }

  const upstream = await fetch(`${API_BASE_URL}/ai/config`, {
    method: "PUT",
    headers: {
      ...withBearerHeaders(session.accessToken),
      ...withJsonHeaders(),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  })

  const payload = await upstream.json().catch(() => null)
  if (!upstream.ok) {
    return NextResponse.json(
      { message: getErrorMessage(payload, "Failed to update AI LLM configuration") },
      { status: upstream.status },
    )
  }

  return NextResponse.json(payload)
}
