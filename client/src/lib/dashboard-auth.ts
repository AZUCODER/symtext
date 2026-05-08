import { redirect } from "next/navigation"

import { auth } from "@/auth"
import type { DashboardUser } from "@/lib/dashboard-types"

export async function requireDashboardUser(nextPath: string): Promise<{ token: string; user: DashboardUser }> {
  const session = await auth()

  if (!session || !session.accessToken || session.error === "RefreshTokenExpired") {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`)
  }

  return {
    token: session.accessToken,
    user: {
      name: session.user.name ?? "",
      email: session.user.email ?? "",
      role: session.user.role,
    },
  }
}