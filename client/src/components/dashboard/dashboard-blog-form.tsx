"use client"

import { FormEvent, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ArchiveIcon, CheckCircleIcon, ChevronDownIcon, ChevronUpIcon, UploadIcon } from "lucide-react"

import {
  archiveBlogPost,
  createBlogPost,
  generateBlogDraft,
  publishBlogPost,
  updateBlogPost,
} from "@/lib/blog-client"
import type { BlogPost, BlogPostStatus, BlogPostVisibility, BlogCreatePayload } from "@/lib/dashboard-types"
import { toAbsoluteHttpUrl, uploadFileToOss } from "@/lib/media-client"
import { queryKeys } from "@/lib/query-keys"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const BlocknoteBlogEditor = dynamic(
  () => import("@/components/dashboard/blocknote-blog-editor").then((mod) => mod.BlocknoteBlogEditor),
  {
    ssr: false,
    loading: () => <div className="min-h-72 w-full animate-pulse rounded-md border border-input bg-input/20" />,
  },
)

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

const STATUS_OPTIONS: { value: BlogPostStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "review", label: "In Review" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
]

const VISIBILITY_OPTIONS: { value: BlogPostVisibility; label: string }[] = [
  { value: "public", label: "Public" },
  { value: "unlisted", label: "Unlisted" },
  { value: "private", label: "Private" },
]

const SELECT_TRIGGER_CLASS =
  "h-10 w-full rounded-md border-input bg-input/20 px-3 text-sm data-[size=default]:h-10"

const TEXTAREA_CLASS =
  "w-full rounded-md border border-input bg-input/20 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"

const SEO_TITLE_MAX_LENGTH = 70
const SEO_DESCRIPTION_MAX_LENGTH = 160

function clampText(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value
}

type Props = {
  post?: BlogPost
}

export function DashboardBlogForm({ post }: Props) {
  const isEditing = post !== undefined
  const router = useRouter()
  const queryClient = useQueryClient()
  const [currentPost, setCurrentPost] = useState<BlogPost | undefined>(post)

  const [title, setTitle] = useState(post?.title ?? "")
  const [slug, setSlug] = useState(post?.slug ?? "")
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(isEditing)
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "")
  const [contentMarkdown, setContentMarkdown] = useState(post?.content_markdown ?? "")
  const [contentJson, setContentJson] = useState<string | null>(post?.content_json ?? null)
  const [isEditorEmpty, setIsEditorEmpty] = useState(
    (post?.content_markdown?.trim().length ?? 0) === 0 && !post?.content_json
  )
  const [status, setStatus] = useState<BlogPostStatus>(post?.status ?? "draft")
  const [visibility, setVisibility] = useState<BlogPostVisibility>(post?.visibility ?? "private")
  const [locale, setLocale] = useState(post?.locale ?? "en")
  const [scheduledAt, setScheduledAt] = useState(post?.scheduled_at?.slice(0, 16) ?? "")
  const [showSeo, setShowSeo] = useState(false)
  const [seoTitle, setSeoTitle] = useState(post?.seo_title ?? "")
  const [seoDescription, setSeoDescription] = useState(post?.seo_description ?? "")
  const [canonicalUrl, setCanonicalUrl] = useState(post?.canonical_url ?? "")
  const [coverImageUrl, setCoverImageUrl] = useState(() => toAbsoluteHttpUrl(post?.cover_image_url ?? ""))
  const [isUploadingCoverImage, setIsUploadingCoverImage] = useState(false)
  const [aiPrompt, setAiPrompt] = useState("")
  const [minScheduledAt] = useState(() => new Date(Date.now() + 60_000).toISOString().slice(0, 16))
  const [editorSeed, setEditorSeed] = useState(0)
  const [editorInitialMarkdown, setEditorInitialMarkdown] = useState(post?.content_markdown ?? "")
  const [editorInitialJson, setEditorInitialJson] = useState<string | null | undefined>(post?.content_json ?? null)
  const [error, setError] = useState<string | null>(null)

  const coverFileInputRef = useRef<HTMLInputElement | null>(null)

  function invalidateLists() {
    queryClient.invalidateQueries({ queryKey: queryKeys.blogPostsBase })
  }

  const createMutation = useMutation({
    mutationFn: (payload: BlogCreatePayload) => createBlogPost(payload),
    onSuccess: (created) => {
      invalidateLists()
      router.push(`/dashboard/blog/${created.id}`)
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to create post"),
  })

  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateBlogPost>[1]) =>
      updateBlogPost(post!.id, payload),
    onSuccess: (updated) => {
      setCurrentPost(updated)
      queryClient.setQueryData<BlogPost>(queryKeys.blogPost(updated.id), updated)
      invalidateLists()
      setError(null)
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to save post"),
  })

  const publishMutation = useMutation({
    mutationFn: () => publishBlogPost(post!.id),
    onSuccess: (updated) => {
      setCurrentPost(updated)
      queryClient.setQueryData<BlogPost>(queryKeys.blogPost(updated.id), updated)
      invalidateLists()
      setStatus(updated.status)
      setError(null)
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to publish"),
  })

  const archiveMutation = useMutation({
    mutationFn: () => archiveBlogPost(post!.id),
    onSuccess: (updated) => {
      setCurrentPost(updated)
      queryClient.setQueryData<BlogPost>(queryKeys.blogPost(updated.id), updated)
      invalidateLists()
      setStatus(updated.status)
      setError(null)
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to archive"),
  })

  const generateDraftMutation = useMutation({
    mutationFn: () =>
      generateBlogDraft({
        prompt: aiPrompt,
        locale,
        action: contentMarkdown.trim().length > 0 ? "rewrite" : "generate",
      }),
    onSuccess: (suggestion) => {
      setTitle(suggestion.title)
      if (!slugManuallyEdited) {
        setSlug(slugify(suggestion.title))
      }
      setExcerpt(suggestion.excerpt)
      setSeoTitle(clampText(suggestion.seo_title, SEO_TITLE_MAX_LENGTH))
      setSeoDescription(clampText(suggestion.seo_description, SEO_DESCRIPTION_MAX_LENGTH))
      setShowSeo(true)
      setContentMarkdown(suggestion.content_markdown)
      setContentJson(null)
      setEditorInitialMarkdown(suggestion.content_markdown)
      setEditorInitialJson(null)
      setEditorSeed((prev) => prev + 1)
      setIsEditorEmpty(suggestion.content_markdown.trim().length === 0)
      setError(null)
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to generate AI draft"),
  })

  function buildPayload(): BlogCreatePayload {
    const normalizedCoverImageUrl = toAbsoluteHttpUrl(coverImageUrl)

    return {
      slug: slug.trim(),
      title: title.trim(),
      excerpt: excerpt.trim() || null,
      content_markdown: contentMarkdown,
      content_json: contentJson,
      status,
      visibility,
      locale: locale.trim() || "en",
      seo_title: clampText(seoTitle.trim(), SEO_TITLE_MAX_LENGTH) || null,
      seo_description: clampText(seoDescription.trim(), SEO_DESCRIPTION_MAX_LENGTH) || null,
      canonical_url: canonicalUrl.trim() || null,
      cover_image_url: normalizedCoverImageUrl || null,
      scheduled_at: status === "scheduled" && scheduledAt ? new Date(scheduledAt).toISOString() : null,
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!title.trim()) { setError("Title is required"); return }
    if (!slug.trim()) { setError("Slug is required"); return }
    if (isEditorEmpty) { setError("Content is required"); return }
    if (status === "scheduled" && !scheduledAt) { setError("Scheduled date is required when status is Scheduled"); return }

    const payload = buildPayload()
    if (isEditing) {
      updateMutation.mutate({ ...payload, expected_version: currentPost?.version })
    } else {
      createMutation.mutate(payload)
    }
  }

  async function handleCoverFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed for cover uploads")
      event.target.value = ""
      return
    }

    setError(null)
    setIsUploadingCoverImage(true)

    try {
      const uploaded = await uploadFileToOss({
        file,
        mediaType: "image",
        folder: "blog-cover",
      })
      setCoverImageUrl(uploaded.publicUrl)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Failed to upload cover image")
    } finally {
      setIsUploadingCoverImage(false)
      event.target.value = ""
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const currentStatus = currentPost?.status
  const canPublish = isEditing && currentStatus !== "published" && currentStatus !== "archived"
  const canArchive = isEditing && currentStatus !== "archived"

  return (
    <div className="flex flex-col gap-6">
      {/* Header toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{isEditing ? "Edit Post" : "New Post"}</h1>
          {isEditing && (
            <Badge
              variant={
                currentStatus === "published"
                  ? "default"
                  : currentStatus === "archived"
                  ? "destructive"
                  : "secondary"
              }
            >
              {currentStatus}
            </Badge>
          )}
        </div>
        {isEditing && (
          <div className="flex gap-2">
            {canPublish && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={publishMutation.isPending}
                onClick={() => publishMutation.mutate()}
              >
                <CheckCircleIcon className="mr-1.5 h-4 w-4" />
                {publishMutation.isPending ? "Publishing…" : "Publish"}
              </Button>
            )}
            {canArchive && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={archiveMutation.isPending}
                onClick={() => archiveMutation.mutate()}
              >
                <ArchiveIcon className="mr-1.5 h-4 w-4" />
                {archiveMutation.isPending ? "Archiving…" : "Archive"}
              </Button>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
          {/* Main content column */}
          <div className="flex flex-col gap-6">
            <Card>
              <CardContent className="pt-6">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="ai-blog-prompt">AI Draft Prompt</FieldLabel>
                    <textarea
                      id="ai-blog-prompt"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="Describe what the blog post should cover, target audience, and tone..."
                      rows={3}
                      className={TEXTAREA_CLASS}
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={generateDraftMutation.isPending || aiPrompt.trim().length === 0}
                        onClick={() => {
                          setError(null)
                          generateDraftMutation.mutate()
                        }}
                      >
                        {generateDraftMutation.isPending ? "Generating Draft..." : "Generate with AI"}
                      </Button>
                      <FieldDescription>
                        Uses Vercel AI SDK agent flow to generate title, markdown, summary-based excerpt, and SEO metadata.
                      </FieldDescription>
                    </div>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="post-title">Title *</FieldLabel>
                    <Input
                      id="post-title"
                      value={title}
                      onChange={(e) => {
                        const nextTitle = e.target.value
                        setTitle(nextTitle)
                        if (!slugManuallyEdited) {
                          setSlug(slugify(nextTitle))
                        }
                      }}
                      placeholder="Your post title"
                      maxLength={200}
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="post-slug">Slug *</FieldLabel>
                    <Input
                      id="post-slug"
                      value={slug}
                      onChange={(e) => {
                        setSlug(e.target.value)
                        setSlugManuallyEdited(true)
                      }}
                      placeholder="url-friendly-slug"
                      maxLength={128}
                      required
                    />
                    <FieldDescription>Used in the post URL. Auto-generated from title.</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="post-excerpt">Excerpt</FieldLabel>
                    <textarea
                      id="post-excerpt"
                      value={excerpt}
                      onChange={(e) => setExcerpt(e.target.value)}
                      placeholder="Short summary shown in listings and meta descriptions (max 320 chars)"
                      maxLength={320}
                      rows={2}
                      className={TEXTAREA_CLASS}
                    />
                    <FieldDescription>{excerpt.length}/320</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="post-content">Content *</FieldLabel>
                    <div id="post-content" role="group" aria-label="Block editor">
                      <BlocknoteBlogEditor
                        key={`blog-editor-${editorSeed}`}
                        initialMarkdown={editorInitialMarkdown}
                        initialJson={editorInitialJson}
                        onChange={(value) => {
                          setContentMarkdown(value.markdown)
                          setContentJson(value.json)
                          setIsEditorEmpty(value.isEmpty)
                        }}
                      />
                    </div>
                    <FieldDescription>
                      Notion-style editor with slash commands, formatting toolbar, and block-based content.
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              </CardContent>
            </Card>

            {/* SEO accordion */}
            <Card>
              <CardHeader
                className="cursor-pointer select-none"
                onClick={() => setShowSeo((v) => !v)}
              >
                <CardTitle className="flex items-center justify-between text-base">
                  SEO & Metadata
                  {showSeo ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                </CardTitle>
              </CardHeader>
              {showSeo && (
                <CardContent>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="seo-title">SEO Title</FieldLabel>
                      <Input
                        id="seo-title"
                        value={seoTitle}
                        onChange={(e) => setSeoTitle(clampText(e.target.value, SEO_TITLE_MAX_LENGTH))}
                        placeholder="Override title for search engines (max 70 chars)"
                        maxLength={SEO_TITLE_MAX_LENGTH}
                      />
                      <FieldDescription>{seoTitle.length}/{SEO_TITLE_MAX_LENGTH}</FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="seo-description">Meta Description</FieldLabel>
                      <textarea
                        id="seo-description"
                        value={seoDescription}
                        onChange={(e) =>
                          setSeoDescription(clampText(e.target.value, SEO_DESCRIPTION_MAX_LENGTH))
                        }
                        placeholder="Search engine snippet (max 160 chars)"
                        maxLength={SEO_DESCRIPTION_MAX_LENGTH}
                        rows={3}
                        className={TEXTAREA_CLASS}
                      />
                      <FieldDescription>
                        {seoDescription.length}/{SEO_DESCRIPTION_MAX_LENGTH}
                      </FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="cover-image">Cover Image URL</FieldLabel>
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <Input
                            id="cover-image"
                            value={coverImageUrl}
                            onChange={(e) => setCoverImageUrl(toAbsoluteHttpUrl(e.target.value))}
                            placeholder="https://..."
                            type="text"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isUploadingCoverImage}
                            onClick={() => coverFileInputRef.current?.click()}
                          >
                            <UploadIcon className="mr-1.5 h-4 w-4" />
                            {isUploadingCoverImage ? "Uploading…" : "Upload"}
                          </Button>
                        </div>
                        <input
                          ref={coverFileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleCoverFileChange}
                        />
                        <FieldDescription>
                          Upload image directly to Alibaba Cloud OSS and auto-fill the cover URL.
                        </FieldDescription>
                      </div>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="canonical-url">Canonical URL</FieldLabel>
                      <Input
                        id="canonical-url"
                        value={canonicalUrl}
                        onChange={(e) => setCanonicalUrl(e.target.value)}
                        placeholder="https://…"
                        type="url"
                      />
                    </Field>
                  </FieldGroup>
                </CardContent>
              )}
            </Card>
          </div>

          {/* Sidebar options column */}
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="post-status">Status</FieldLabel>
                    <Select
                      value={status}
                      onValueChange={(value) => setStatus(value as BlogPostStatus)}
                    >
                      <SelectTrigger id="post-status" className={SELECT_TRIGGER_CLASS}>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  {status === "scheduled" && (
                    <Field>
                      <FieldLabel htmlFor="post-scheduled-at">Publish Date *</FieldLabel>
                      <Input
                        id="post-scheduled-at"
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        min={minScheduledAt}
                        required
                      />
                    </Field>
                  )}
                  <Field>
                    <FieldLabel htmlFor="post-visibility">Visibility</FieldLabel>
                    <Select
                      value={visibility}
                      onValueChange={(value) => setVisibility(value as BlogPostVisibility)}
                    >
                      <SelectTrigger id="post-visibility" className={SELECT_TRIGGER_CLASS}>
                        <SelectValue placeholder="Select visibility" />
                      </SelectTrigger>
                      <SelectContent>
                        {VISIBILITY_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="post-locale">Locale</FieldLabel>
                    <Input
                      id="post-locale"
                      value={locale}
                      onChange={(e) => setLocale(e.target.value)}
                      placeholder="en"
                      maxLength={16}
                    />
                  </Field>
                </FieldGroup>
              </CardContent>
            </Card>

            {isEditing && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Post Info</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="space-y-2 text-xs text-muted-foreground">
                    <div>
                      <dt className="font-medium text-foreground">Author</dt>
                      <dd>{currentPost?.author_email}</dd>
                    </div>
                    {currentPost?.last_edited_by_email && (
                      <div>
                        <dt className="font-medium text-foreground">Last edited by</dt>
                        <dd>{currentPost.last_edited_by_email}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="font-medium text-foreground">Version</dt>
                      <dd>v{currentPost?.version}</dd>
                    </div>
                    {currentPost?.published_at && (
                      <div>
                        <dt className="font-medium text-foreground">Published</dt>
                        <dd>{new Date(currentPost.published_at).toLocaleString()}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="font-medium text-foreground">Updated</dt>
                      <dd>{currentPost?.updated_at ? new Date(currentPost.updated_at).toLocaleString() : "-"}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            )}

            <div className="flex flex-col gap-2">
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending
                  ? isEditing ? "Saving…" : "Creating…"
                  : isEditing ? "Save Changes" : "Create Post"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => router.push("/dashboard/blog")}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
