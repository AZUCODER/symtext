export const queryKeys = {
  adminUsers: ["admin-users"] as const,
  roleAudit: (limit: number) => ["role-audit", limit] as const,
  agentTask: (taskId: string) => ["agent-task", taskId] as const,
  blogPostsBase: ["blog-posts"] as const,
  blogPosts: (params?: Record<string, unknown>) => ["blog-posts", params] as const,
  blogPost: (id: string) => ["blog-post", id] as const,
  aiLlmConfig: ["ai-llm-config"] as const,
  billingConfig: ["billing-config"] as const,
  billingTransactions: (params?: Record<string, unknown>) => ["billing-transactions", params] as const,
}
