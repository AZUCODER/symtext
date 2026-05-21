import { redirect } from "next/navigation"

import { AiLlmConfiguration } from "@/components/dashboard/ai-llm-configuration"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { requireDashboardUser } from "@/lib/dashboard-auth"

export default async function AiLlmConfigurationPage() {
  const { user: currentUser } = await requireDashboardUser("/dashboard/ai-llm-configuration")

  if (currentUser.role !== "admin") {
    redirect("/dashboard")
  }

  return (
    <DashboardShell user={{ name: currentUser.name, email: currentUser.email, role: currentUser.role }}>
      <AiLlmConfiguration currentUserRole={currentUser.role} />
    </DashboardShell>
  )
}
