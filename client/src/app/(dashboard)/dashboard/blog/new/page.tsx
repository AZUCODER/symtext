import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardBlogForm } from "@/components/dashboard/dashboard-blog-form"
import { requireDashboardUser } from "@/lib/dashboard-auth"

export default async function NewBlogPostPage() {
  const { user: currentUser } = await requireDashboardUser("/dashboard/blog/new")

  return (
    <DashboardShell user={{ name: currentUser.name, email: currentUser.email, role: currentUser.role }}>
      <div className="px-4 lg:px-6">
        <DashboardBlogForm />
      </div>
    </DashboardShell>
  )
}
