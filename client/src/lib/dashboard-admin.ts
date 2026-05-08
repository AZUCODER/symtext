import { API_BASE_URL } from "@/lib/config"
import type { DashboardManagedUser, DashboardRoleAuditEvent } from "@/lib/dashboard-types"
import { withBearerHeaders } from "@/lib/http"

type DashboardUsersResponse = {
  users?: DashboardManagedUser[]
}

type DashboardRoleAuditResponse = {
  events?: DashboardRoleAuditEvent[]
}

async function fetchJsonIfOk<T>(input: string, token: string): Promise<T | null> {
  const response = await fetch(input, {
    method: "GET",
    headers: withBearerHeaders(token),
    cache: "no-store",
  }).catch(() => null)

  if (!response?.ok) {
    return null
  }

  return (await response.json().catch(() => null)) as T | null
}

export async function getDashboardAdminData(token: string): Promise<{
  initialUsers: DashboardManagedUser[]
  initialAuditEvents: DashboardRoleAuditEvent[]
}> {
  const [usersPayload, auditPayload] = await Promise.all([
    fetchJsonIfOk<DashboardUsersResponse>(`${API_BASE_URL}/auth/users`, token),
    fetchJsonIfOk<DashboardRoleAuditResponse>(`${API_BASE_URL}/auth/users/role-audit?limit=20`, token),
  ])

  return {
    initialUsers: usersPayload?.users ?? [],
    initialAuditEvents: auditPayload?.events ?? [],
  }
}
