import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardBlogList } from "@/components/dashboard/dashboard-blog-list"
import { requireDashboardUser } from "@/lib/dashboard-auth"

export default async function BlogListPage() {
  const { user: currentUser } = await requireDashboardUser("/dashboard/blog")

  return (
    <DashboardShell user={{ name: currentUser.name, email: currentUser.email, role: currentUser.role }}>
      <div className="px-4 lg:px-6">
        <DashboardBlogList />
      </div>
    </DashboardShell>
  )
}
