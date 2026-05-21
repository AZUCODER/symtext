import { redirect } from "next/navigation"

import { CloudOssConfiguration } from "@/components/dashboard/cloud-oss-configuration"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { requireDashboardUser } from "@/lib/dashboard-auth"

export default async function CloudOssConfigurationPage() {
  const { user: currentUser } = await requireDashboardUser("/dashboard/cloud-oss-configuration")

  if (currentUser.role !== "admin") {
    redirect("/dashboard")
  }

  return (
    <DashboardShell user={{ name: currentUser.name, email: currentUser.email, role: currentUser.role }}>
      <CloudOssConfiguration currentUserRole={currentUser.role} />
    </DashboardShell>
  )
}
