"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { getAdminUsers, getRoleAudit, updateUserRole } from "@/lib/dashboard-admin-client"
import type { DashboardManagedUser, UserRole } from "@/lib/dashboard-types"
import { queryKeys } from "@/lib/query-keys"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldDescription } from "@/components/ui/field"

export function DashboardRoleManager({
  currentUserEmail,
}: {
  currentUserEmail: string
}) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [updatingEmail, setUpdatingEmail] = useState<string | null>(null)

  const usersQuery = useQuery({
    queryKey: queryKeys.adminUsers,
    queryFn: getAdminUsers,
    staleTime: 60_000,
  })

  const auditEventsQuery = useQuery({
    queryKey: queryKeys.roleAudit(20),
    queryFn: () => getRoleAudit(20),
    staleTime: 60_000,
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ email, role }: { email: string; role: UserRole }) => updateUserRole(email, role),
    onSuccess: async (updatedUser) => {
      queryClient.setQueryData<DashboardManagedUser[]>(queryKeys.adminUsers, (current = []) =>
        current.map((user) => (user.email === updatedUser.email ? updatedUser : user))
      )
      await queryClient.invalidateQueries({ queryKey: queryKeys.roleAudit(20) })
    },
    onError: (requestError) => {
      const message = requestError instanceof Error ? requestError.message : "Failed to update role"
      setError(message)
    },
    onSettled: () => {
      setUpdatingEmail(null)
    },
  })

  const sortedUsers = useMemo(
    () => [...(usersQuery.data ?? [])].sort((a, b) => a.email.localeCompare(b.email)),
    [usersQuery.data]
  )

  async function refreshAdminData() {
    setError(null)
    const [usersResult, auditResult] = await Promise.all([
      usersQuery.refetch(),
      auditEventsQuery.refetch(),
    ])

    const refetchError = usersResult.error ?? auditResult.error
    if (refetchError instanceof Error) {
      setError(refetchError.message)
    }
  }

  function updateRole(email: string, role: UserRole) {
    setUpdatingEmail(email)
    setError(null)
    updateRoleMutation.mutate({ email, role })
  }

  const isRefreshing = usersQuery.isFetching || auditEventsQuery.isFetching
  const resolvedError = error
    ?? (usersQuery.error instanceof Error ? usersQuery.error.message : null)
    ?? (auditEventsQuery.error instanceof Error ? auditEventsQuery.error.message : null)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>User Roles</CardTitle>
        <Button type="button" variant="outline" onClick={refreshAdminData} disabled={isRefreshing}>
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {resolvedError ? <FieldDescription className="text-destructive">{resolvedError}</FieldDescription> : null}
        {sortedUsers.map((user) => (
          <div
            key={user.email}
            className="flex flex-col gap-2 rounded-md border border-border p-3 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
              <p className="text-xs text-muted-foreground">
                {user.is_verified ? "Verified" : "Unverified"}
                {user.email === currentUserEmail ? " • You" : ""}
              </p>
            </div>
            <select
              value={user.role}
              onChange={(event) => void updateRole(user.email, event.target.value as UserRole)}
              disabled={updatingEmail === user.email}
              className="h-9 rounded-md border border-input bg-input/20 px-3 text-sm outline-none"
            >
              <option value="viewer">viewer</option>
              <option value="editor">editor</option>
              <option value="admin">admin</option>
            </select>
          </div>
        ))}
        <div className="pt-3">
          <p className="mb-2 text-sm font-medium">Recent Role Changes</p>
          <div className="space-y-2">
            {(auditEventsQuery.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No role changes recorded yet.</p>
            ) : (
              (auditEventsQuery.data ?? []).map((event, index) => (
                <div key={`${event.changed_at}-${event.target_email}-${index}`} className="rounded-md border border-border px-3 py-2">
                  <p className="text-xs text-foreground/90">
                    {event.actor_email} changed {event.target_email} from {event.previous_role} to {event.new_role}
                  </p>
                  <p className="text-xs text-muted-foreground">{new Date(event.changed_at).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
