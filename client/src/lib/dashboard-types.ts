export type UserRole = "viewer" | "editor" | "admin"

export type DashboardUser = {
  name: string
  email: string
  role: UserRole
}

export type DashboardManagedUser = DashboardUser & {
  is_verified: boolean
}

export type DashboardRoleAuditEvent = {
  actor_email: string
  target_email: string
  previous_role: UserRole
  new_role: UserRole
  changed_at: string
}
