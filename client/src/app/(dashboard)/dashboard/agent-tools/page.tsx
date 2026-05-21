import { DashboardAgentTask } from "@/components/dashboard/dashboard-agent-task"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { requireDashboardUser } from "@/lib/dashboard-auth"

export default async function AgentToolsPage() {
  const { user: currentUser } = await requireDashboardUser("/dashboard/agent-tools")

  return (
    <DashboardShell user={{ name: currentUser.name, email: currentUser.email, role: currentUser.role }}>
      <div className="px-4 lg:px-6">
        <DashboardAgentTask />
      </div>
    </DashboardShell>
  )
}
