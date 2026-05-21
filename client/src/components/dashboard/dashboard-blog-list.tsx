"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { PlusIcon, RefreshCwIcon, MoreHorizontalIcon, PencilIcon, CheckCircleIcon, ArchiveIcon, Trash2Icon, EyeIcon, EyeOffIcon } from "lucide-react"

import {
  archiveBlogPost,
  deleteBlogPost,
  getBlogPosts,
  publishBlogPost,
} from "@/lib/blog-client"
import type { BlogPost, BlogPostStatus } from "@/lib/dashboard-types"
import { queryKeys } from "@/lib/query-keys"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const STATUS_VARIANT: Record<BlogPostStatus, "default" | "secondary" | "destructive" | "outline"> = {
  published: "default",
  draft: "secondary",
  review: "outline",
  scheduled: "outline",
  archived: "destructive",
}

const STATUS_LABELS: Record<BlogPostStatus, string> = {
  draft: "Draft",
  review: "In Review",
  scheduled: "Scheduled",
  published: "Published",
  archived: "Archived",
}

const ALL_STATUSES: BlogPostStatus[] = ["draft", "review", "scheduled", "published", "archived"]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function DashboardBlogList() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<BlogPostStatus | "all">("all")
  const [page, setPage] = useState(1)
  const [actionError, setActionError] = useState<string | null>(null)
  const pageSize = 20

  const queryParams = {
    page,
    page_size: pageSize,
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
  }

  const listQuery = useQuery({
    queryKey: queryKeys.blogPosts(queryParams),
    queryFn: () => getBlogPosts(queryParams),
    staleTime: 30_000,
  })

  function invalidateList() {
    queryClient.invalidateQueries({ queryKey: queryKeys.blogPostsBase })
  }

  const publishMutation = useMutation({
    mutationFn: (id: string) => publishBlogPost(id),
    onSuccess: (updated) => {
      queryClient.setQueryData<BlogPost>(queryKeys.blogPost(updated.id), updated)
      invalidateList()
      setActionError(null)
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : "Failed to publish"),
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveBlogPost(id),
    onSuccess: (updated) => {
      queryClient.setQueryData<BlogPost>(queryKeys.blogPost(updated.id), updated)
      invalidateList()
      setActionError(null)
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : "Failed to archive"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBlogPost(id),
    onSuccess: () => {
      invalidateList()
      setActionError(null)
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : "Failed to delete"),
  })

  const posts = listQuery.data?.items ?? []
  const total = listQuery.data?.total ?? 0
  const totalPages = Math.ceil(total / pageSize)

  const resolvedError =
    actionError ??
    (listQuery.error instanceof Error ? listQuery.error.message : null)

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Blog Posts</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => { setStatusFilter("all"); setPage(1) }}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                statusFilter === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              All
            </button>
            {ALL_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1) }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                  statusFilter === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={listQuery.isFetching}
            onClick={() => listQuery.refetch()}
            aria-label="Refresh"
          >
            <RefreshCwIcon className={`h-4 w-4 ${listQuery.isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Link
            href="/dashboard/blog/new"
            className="inline-flex h-9 items-center justify-center gap-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90"
          >
            <PlusIcon className="h-4 w-4" />
            New Post
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {resolvedError && (
          <p className="mb-4 text-sm text-destructive">{resolvedError}</p>
        )}
        {listQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No blog posts found.{" "}
            <Link href="/dashboard/blog/new" className="underline underline-offset-2">
              Create one.
            </Link>
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Title</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="hidden pb-2 pr-4 font-medium md:table-cell">Visibility</th>
                  <th className="hidden pb-2 pr-4 font-medium lg:table-cell">Author</th>
                  <th className="hidden pb-2 pr-4 font-medium lg:table-cell">Updated</th>
                  <th className="pb-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {posts.map((post) => (
                  <tr key={post.id} className="group hover:bg-muted/40">
                    <td className="py-2.5 pr-4">
                      <div className="flex flex-col">
                        <span className="font-medium leading-tight">{post.title}</span>
                        <span className="text-xs text-muted-foreground">/{post.slug}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4">
                      <Badge variant={STATUS_VARIANT[post.status]}>
                        {STATUS_LABELS[post.status]}
                      </Badge>
                    </td>
                    <td className="hidden py-2.5 pr-4 md:table-cell">
                      <span className="flex items-center gap-1 text-xs capitalize text-muted-foreground">
                        {post.visibility === "public" ? (
                          <EyeIcon className="h-3 w-3" />
                        ) : (
                          <EyeOffIcon className="h-3 w-3" />
                        )}
                        {post.visibility}
                      </span>
                    </td>
                    <td className="hidden py-2.5 pr-4 text-xs text-muted-foreground lg:table-cell">
                      {post.author_email}
                    </td>
                    <td className="hidden py-2.5 pr-4 text-xs text-muted-foreground lg:table-cell">
                      {formatDate(post.updated_at)}
                    </td>
                    <td className="py-2.5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center rounded-md p-0 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                          <MoreHorizontalIcon className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/dashboard/blog/${post.id}`)}>
                            <PencilIcon className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          {post.status !== "published" && post.status !== "archived" && (
                            <DropdownMenuItem
                              onClick={() => publishMutation.mutate(post.id)}
                              disabled={publishMutation.isPending}
                            >
                              <CheckCircleIcon className="mr-2 h-4 w-4" />
                              Publish
                            </DropdownMenuItem>
                          )}
                          {post.status !== "archived" && (
                            <DropdownMenuItem
                              onClick={() => archiveMutation.mutate(post.id)}
                              disabled={archiveMutation.isPending}
                            >
                              <ArchiveIcon className="mr-2 h-4 w-4" />
                              Archive
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              if (confirm(`Delete "${post.title}"?`)) {
                                deleteMutation.mutate(post.id)
                              }
                            }}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2Icon className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>{total} posts</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="flex items-center px-2">
                {page} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
