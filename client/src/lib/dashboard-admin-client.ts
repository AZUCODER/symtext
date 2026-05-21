import type {
  AdminCreateUserPayload,
  AdminUpdateUserPayload,
  DashboardManagedUser,
  DashboardRoleAuditEvent,
  UserRole,
} from "@/lib/dashboard-types"

type ErrorPayload = {
  message?: string
}

type UsersPayload = {
  users?: DashboardManagedUser[]
}

type RoleAuditPayload = {
  events?: DashboardRoleAuditEvent[]
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    cache: "no-store",
  })
  const payload = (await response.json().catch(() => null)) as (T & ErrorPayload) | null

  if (!response.ok) {
    throw new Error(payload?.message ?? "Request failed")
  }

  return (payload ?? {}) as T
}

export async function getAdminUsers(): Promise<DashboardManagedUser[]> {
  const payload = await requestJson<UsersPayload>("/api/admin/users", { method: "GET" })
  return payload.users ?? []
}

export async function getRoleAudit(limit = 20): Promise<DashboardRoleAuditEvent[]> {
  const payload = await requestJson<RoleAuditPayload>(`/api/admin/role-audit?limit=${limit}`, {
    method: "GET",
  })
  return payload.events ?? []
}

export async function updateUserRole(email: string, role: UserRole): Promise<DashboardManagedUser> {
  return requestJson<DashboardManagedUser>("/api/admin/users", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, role }),
  })
}

export async function createAdminUser(payload: AdminCreateUserPayload): Promise<DashboardManagedUser> {
  return requestJson<DashboardManagedUser>("/api/admin/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
}

export async function updateAdminUser(
  email: string,
  payload: AdminUpdateUserPayload
): Promise<DashboardManagedUser> {
  return requestJson<DashboardManagedUser>(`/api/admin/users/${encodeURIComponent(email)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
}

export async function deleteUser(email: string): Promise<void> {
  await requestJson<{ message: string }>(`/api/admin/users/${encodeURIComponent(email)}`, {
    method: "DELETE",
  })
}
