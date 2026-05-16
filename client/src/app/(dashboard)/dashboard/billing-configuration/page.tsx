import { redirect } from "next/navigation"

import { BillingConfiguration } from "@/components/dashboard/billing-configuration"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { requireDashboardUser } from "@/lib/dashboard-auth"

export default async function BillingConfigurationPage() {
  const { user: currentUser } = await requireDashboardUser("/dashboard/billing-configuration")

  if (currentUser.role !== "admin") {
    redirect("/dashboard")
  }

  return (
    <DashboardShell user={{ name: currentUser.name, email: currentUser.email, role: currentUser.role }}>
      <BillingConfiguration currentUserRole={currentUser.role} />
    </DashboardShell>
  )
}
