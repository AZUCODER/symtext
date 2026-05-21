import { NextResponse } from "next/server"

import { API_BASE_URL } from "@/app/api/_lib/auth"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const objectKey = searchParams.get("key")?.trim() ?? ""

  if (!objectKey) {
    return NextResponse.json({ message: "Missing key" }, { status: 400 })
  }

  const upstream = await fetch(
    `${API_BASE_URL}/media/oss/read-url?object_key=${encodeURIComponent(objectKey)}`,
    {
      method: "GET",
      cache: "no-store",
    }
  )

  const payload = (await upstream.json().catch(() => null)) as { url?: string; detail?: string } | null

  if (!upstream.ok || !payload?.url) {
    return NextResponse.json(
      { message: payload?.detail ?? "Failed to resolve media URL" },
      { status: upstream.status || 502 }
    )
  }

  return NextResponse.redirect(payload.url, { status: 302 })
}
