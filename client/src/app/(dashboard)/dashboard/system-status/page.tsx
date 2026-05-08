import { dehydrate, HydrationBoundary } from "@tanstack/react-query"

import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardRoleManager } from "@/components/dashboard/dashboard-role-manager"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { getDashboardAdminData } from "@/lib/dashboard-admin"
import { getHealth } from "@/lib/api"
import { requireDashboardUser } from "@/lib/dashboard-auth"
import { queryKeys } from "@/lib/query-keys"
import { makeQueryClient } from "@/lib/react-query"

export default async function SystemStatusPage() {
  const { token, user: currentUser } = await requireDashboardUser("/dashboard/system-status")

  const health = await getHealth().catch(() => null)
  const queryClient = makeQueryClient()

  if (currentUser.role === "admin") {
    const { initialUsers, initialAuditEvents } = await getDashboardAdminData(token)
    queryClient.setQueryData(queryKeys.adminUsers, initialUsers)
    queryClient.setQueryData(queryKeys.roleAudit(20), initialAuditEvents)
  }

  return (
    <DashboardShell user={{ name: currentUser.name, email: currentUser.email }}>
      <div className="px-4 lg:px-6">
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="text-sm text-muted-foreground">
              Backend status: {health ? `${health.service} (${health.environment})` : "Unavailable"}
            </p>
            <Badge variant={health?.status === "ok" ? "default" : "destructive"}>
              {health?.status === "ok" ? "API Connected" : "API Disconnected"}
            </Badge>
          </CardContent>
        </Card>
      </div>
      {currentUser.role === "admin" ? (
        <div className="px-4 lg:px-6 mt-4">
          <HydrationBoundary state={dehydrate(queryClient)}>
            <DashboardRoleManager currentUserEmail={currentUser.email} />
          </HydrationBoundary>
        </div>
      ) : null}
    </DashboardShell>
  )
}
