export type UserRole = "viewer" | "editor" | "admin"
export type CloudOssProvider = "aliyunoss" | "huaweioss" | "awsoss"
export type AiLlmProvider = "deepseek" | "openai" | "groq" | "openai_compatible"

export type DashboardUser = {
  name: string
  email: string
  role: UserRole
}

export type DashboardManagedUser = DashboardUser & {
  is_verified: boolean
  created_at: string
  updated_at: string
}

export type AdminCreateUserPayload = {
  email: string
  name?: string | null
  role?: UserRole
  is_verified?: boolean
  send_verification?: boolean
}

export type AdminUpdateUserPayload = {
  name?: string
  role?: UserRole
  is_verified?: boolean
}

export type DashboardRoleAuditEvent = {
  actor_email: string
  target_email: string
  previous_role: UserRole
  new_role: UserRole
  changed_at: string
}

export type BlogPostStatus = "draft" | "review" | "scheduled" | "published" | "archived"
export type BlogPostVisibility = "public" | "unlisted" | "private"

export type BlogPost = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  content_markdown: string
  content_json: string | null
  status: BlogPostStatus
  visibility: BlogPostVisibility
  seo_title: string | null
  seo_description: string | null
  canonical_url: string | null
  cover_image_url: string | null
  locale: string
  author_email: string
  last_edited_by_email: string | null
  published_at: string | null
  scheduled_at: string | null
  version: number
  ai_summary: string | null
  ai_keywords_json: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type BlogListResponse = {
  items: BlogPost[]
  page: number
  page_size: number
  total: number
}

export type BlogCreatePayload = {
  slug: string
  title: string
  excerpt?: string | null
  content_markdown: string
  content_json?: string | null
  status?: BlogPostStatus
  visibility?: BlogPostVisibility
  seo_title?: string | null
  seo_description?: string | null
  canonical_url?: string | null
  cover_image_url?: string | null
  locale?: string
  scheduled_at?: string | null
}

export type BlogUpdatePayload = Partial<BlogCreatePayload> & {
  expected_version?: number
}

export type CloudOssProviderStatus = {
  provider: CloudOssProvider
  configured: boolean
  supports_signed_upload: boolean
}

export type CloudOssEditableFields = {
  endpoint: string
  bucket_name: string
  public_base_url: string
  access_key_id: string
  access_key_secret: string
  has_access_key_id: boolean
  has_access_key_secret: boolean
}

export type CloudOssConfig = {
  selected_provider: CloudOssProvider
  providers: CloudOssProviderStatus[]
  editable: CloudOssEditableFields
}

export type CloudOssConfigUpdatePayload = {
  selected_provider: CloudOssProvider
  endpoint: string
  bucket_name: string
  public_base_url: string
  access_key_id?: string
  access_key_secret?: string
}

export type AiLlmProviderStatus = {
  provider: AiLlmProvider
  configured: boolean
}

export type AiLlmConfig = {
  selected_provider: AiLlmProvider
  model: string
  temperature: number
  max_tokens: number
  system_prompt: string | null
  providers: AiLlmProviderStatus[]
  editable: {
    api_key: string
    base_url: string
    has_api_key: boolean
  }
}

export type AiLlmConfigUpdatePayload = {
  selected_provider: AiLlmProvider
  model: string
  temperature: number
  max_tokens: number
  system_prompt?: string | null
  api_key?: string
  base_url?: string
}

export type BillingProvider = "paypal" | "alipay"
export type BillingMode = "sandbox" | "live"
export type BillingTransactionType = "charge" | "renewal" | "refund" | "adjustment"
export type BillingTransactionStatus = "pending" | "succeeded" | "failed" | "refunded"

export type BillingGatewayProviderStatus = {
  provider: BillingProvider
  configured: boolean
  enabled: boolean
  mode: BillingMode
}

export type BillingGatewayConfig = {
  selected_provider: BillingProvider
  providers: BillingGatewayProviderStatus[]
  mode: BillingMode
  enabled: boolean
  editable: {
    app_id: string
    secret: string
    webhook_secret: string
    has_app_id: boolean
    has_secret: boolean
    has_webhook_secret: boolean
  }
}

export type BillingGatewayConfigUpdatePayload = {
  selected_provider: BillingProvider
  mode: BillingMode
  enabled: boolean
  app_id?: string
  secret?: string
  webhook_secret?: string
}

export type BillingTransactionItem = {
  id: string
  customer_id: string | null
  user_email: string | null
  provider: BillingProvider
  provider_transaction_id: string
  provider_order_id: string | null
  provider_subscription_id: string | null
  transaction_type: BillingTransactionType
  currency: string
  amount_minor: number
  status_canonical: BillingTransactionStatus
  status_provider_raw: string | null
  occurred_at: string
}

export type BillingTransactionListResponse = {
  items: BillingTransactionItem[]
  total: number
}

export type BillingReconcileItem = {
  transaction_id: string
  provider: BillingProvider
  previous_status: BillingTransactionStatus
  new_status: BillingTransactionStatus
  provider_transaction_id: string
}

export type BillingReconcileResponse = {
  scanned: number
  updated: number
  skipped_unsupported_provider: number
  items: BillingReconcileItem[]
}
