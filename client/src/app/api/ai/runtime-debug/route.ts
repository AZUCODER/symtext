import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { resolveAiRuntime } from "@/lib/ai/runtime"

export async function GET() {
  const session = await auth()
  if (!session?.accessToken) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role !== "admin") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 })
  }

  try {
    const runtime = await resolveAiRuntime(session.accessToken)

    return NextResponse.json({
      selected_provider: runtime.requestedProvider,
      active_provider: runtime.activeProvider,
      fallback_applied: runtime.fallbackApplied,
      model: runtime.config.model,
      runtime_provider: runtime.config.runtime.provider,
      provider_statuses_from_backend: runtime.config.providers ?? [],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resolve AI runtime"
    return NextResponse.json({ message }, { status: 500 })
  }
}
