export const queryKeys = {
  adminUsers: ["admin-users"] as const,
  roleAudit: (limit: number) => ["role-audit", limit] as const,
  agentTask: (taskId: string) => ["agent-task", taskId] as const,
}
