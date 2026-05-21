import { notFound } from "next/navigation"

import { API_BASE_URL } from "@/app/api/_lib/auth"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardBlogForm } from "@/components/dashboard/dashboard-blog-form"
import { requireDashboardUser } from "@/lib/dashboard-auth"
import type { BlogPost } from "@/lib/dashboard-types"
import { withBearerHeaders } from "@/lib/http"

type Props = { params: Promise<{ id: string }> }

async function fetchPost(
  id: string,
  token: string
): Promise<{ post: BlogPost | null; status: number }> {
  try {
    const response = await fetch(`${API_BASE_URL}/blog/${id}`, {
      headers: withBearerHeaders(token),
      cache: "no-store",
    })

    if (!response.ok) {
      return { post: null, status: response.status }
    }

    const post = (await response.json().catch(() => null)) as BlogPost | null
    return { post, status: response.status }
  } catch {
    return { post: null, status: 500 }
  }
}

export default async function EditBlogPostPage({ params }: Props) {
  const { id } = await params
  const { user: currentUser, token } = await requireDashboardUser(`/dashboard/blog/${id}`)

  const { post, status } = await fetchPost(id, token)
  if (status === 404) notFound()
  if (!post) {
    throw new Error("Failed to load blog post")
  }

  return (
    <DashboardShell user={{ name: currentUser.name, email: currentUser.email, role: currentUser.role }}>
      <div className="px-4 lg:px-6">
        <DashboardBlogForm post={post} />
      </div>
    </DashboardShell>
  )
}
