import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardUsersAdmin } from "@/components/dashboard/dashboard-users-admin"
import { requireDashboardUser } from "@/lib/dashboard-auth"

export default async function UsersPage() {
  const { user: currentUser } = await requireDashboardUser("/dashboard/users")

  return (
    <DashboardShell user={{ name: currentUser.name, email: currentUser.email, role: currentUser.role }}>
      <div className="px-4 lg:px-6">
        <DashboardUsersAdmin currentUserEmail={currentUser.email} currentUserRole={currentUser.role} />
      </div>
    </DashboardShell>
  )
}
