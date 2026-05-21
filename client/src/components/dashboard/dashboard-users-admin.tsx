"use client"

import { useCallback, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  ArrowUpDownIcon,
  CopyIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SaveIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  TrashIcon,
  XIcon,
} from "lucide-react"

import {
  createAdminUser,
  deleteUser,
  getAdminUsers,
  getRoleAudit,
  updateAdminUser,
} from "@/lib/dashboard-admin-client"
import type { DashboardManagedUser, UserRole } from "@/lib/dashboard-types"
import { queryKeys } from "@/lib/query-keys"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "viewer", label: "Viewer" },
  { value: "editor", label: "Editor" },
  { value: "admin", label: "Admin" },
]

const ROLE_BADGE: Record<UserRole, "secondary" | "default" | "destructive"> = {
  viewer: "secondary",
  editor: "default",
  admin: "destructive",
}

const SELECT_TRIGGER_CLASS =
  "h-8 w-full min-w-28 rounded-md border-input bg-input/20 px-2 text-xs data-[size=default]:h-8"

const HEADER_BUTTON_CLASS = "h-7 px-1.5 text-xs text-muted-foreground"

function RelativeDate({ iso }: { iso: string }) {
  const date = new Date(iso)
  return (
    <time dateTime={iso} title={date.toLocaleString()}>
      {date.toLocaleDateString()}
    </time>
  )
}

export function DashboardUsersAdmin({
  currentUserEmail,
  currentUserRole,
}: {
  currentUserEmail: string
  currentUserRole: UserRole
}) {
  const queryClient = useQueryClient()
  const canManageUsers = currentUserRole === "admin"
  const canViewAudit = currentUserRole === "admin" || currentUserRole === "editor"
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all")
  const [verifiedFilter, setVerifiedFilter] = useState<"all" | "yes" | "no">("all")
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [actingEmail, setActingEmail] = useState<string | null>(null)

  const [createEmail, setCreateEmail] = useState("")
  const [createName, setCreateName] = useState("")
  const [createRole, setCreateRole] = useState<UserRole>("viewer")
  const [createVerified, setCreateVerified] = useState(false)
  const [sendVerification, setSendVerification] = useState(false)

  const [editingEmail, setEditingEmail] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [editingRole, setEditingRole] = useState<UserRole>("viewer")
  const [editingVerified, setEditingVerified] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([{ id: "updated_at", desc: true }])

  // ── queries ──────────────────────────────────────────────────────────────
  const usersQuery = useQuery({
    queryKey: queryKeys.adminUsers,
    queryFn: getAdminUsers,
    staleTime: 60_000,
  })

  const auditQuery = useQuery({
    queryKey: queryKeys.roleAudit(50),
    queryFn: () => getRoleAudit(50),
    staleTime: 60_000,
    enabled: canViewAudit,
  })

  // ── mutations ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: () =>
      createAdminUser({
        email: createEmail.trim().toLowerCase(),
        name: createName.trim() || null,
        role: createRole,
        is_verified: createVerified,
        send_verification: sendVerification,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData<DashboardManagedUser[]>(queryKeys.adminUsers, (curr = []) =>
        [...curr, updated].sort((a, b) => a.email.localeCompare(b.email))
      )
      setCreateEmail("")
      setCreateName("")
      setCreateRole("viewer")
      setCreateVerified(false)
      setSendVerification(false)
      setActionError(null)
      setActionNotice(`User ${updated.email} created successfully.`)
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : "Failed to create user"),
  })

  const updateMutation = useMutation({
    mutationFn: (email: string) =>
      updateAdminUser(email, {
        name: editingName,
        role: editingRole,
        is_verified: editingVerified,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData<DashboardManagedUser[]>(queryKeys.adminUsers, (curr = []) =>
        curr.map((u) => (u.email === updated.email ? updated : u))
      )
      setEditingEmail(null)
      setActionError(null)
      setActionNotice(`User ${updated.email} updated successfully.`)
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : "Failed to update user"),
    onSettled: () => setActingEmail(null),
  })

  const deleteMutation = useMutation({
    mutationFn: (email: string) => deleteUser(email),
    onSuccess: (_data, deletedEmail) => {
      queryClient.setQueryData<DashboardManagedUser[]>(queryKeys.adminUsers, (curr = []) =>
        curr.filter((u) => u.email !== deletedEmail)
      )
      if (editingEmail === deletedEmail) {
        setEditingEmail(null)
      }
      setActionError(null)
      setActionNotice(`User ${deletedEmail} deleted successfully.`)
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : "Failed to delete user"),
    onSettled: () => setActingEmail(null),
  })

  // ── filtered list ─────────────────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (usersQuery.data ?? []).filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false
      if (verifiedFilter === "yes" && !u.is_verified) return false
      if (verifiedFilter === "no" && u.is_verified) return false
      if (term && !u.email.toLowerCase().includes(term) && !u.name.toLowerCase().includes(term))
        return false
      return true
    })
  }, [usersQuery.data, search, roleFilter, verifiedFilter])

  // ── handlers ──────────────────────────────────────────────────────────────
  function startEdit(user: DashboardManagedUser) {
    setEditingEmail(user.email)
    setEditingName(user.name)
    setEditingRole(user.role)
    setEditingVerified(user.is_verified)
    setActionError(null)
    setActionNotice(null)
  }

  function cancelEdit() {
    setEditingEmail(null)
    setActionError(null)
    setActionNotice(null)
  }

  function handleCreateUser() {
    if (!canManageUsers) return
    const normalizedEmail = createEmail.trim().toLowerCase()
    const hasValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    if (!hasValidEmail) {
      setActionError("Please enter a valid email address")
      return
    }
    const hasDuplicate = (usersQuery.data ?? []).some((u) => u.email === normalizedEmail)
    if (hasDuplicate) {
      setActionError("A user with this email already exists")
      return
    }
    setActionError(null)
    setActionNotice(null)
    createMutation.mutate()
  }

  const handleSaveUser = useCallback((email: string) => {
    if (!canManageUsers) return
    setActingEmail(email)
    setActionError(null)
    setActionNotice(null)
    updateMutation.mutate(email)
  }, [canManageUsers, updateMutation])

  const handleDelete = useCallback((email: string, name: string) => {
    if (!canManageUsers) return
    if (!confirm(`Delete user "${name}" (${email})? This cannot be undone.`)) return
    setActingEmail(email)
    setActionError(null)
    setActionNotice(null)
    deleteMutation.mutate(email)
  }, [canManageUsers, deleteMutation])

  async function handleCopyEmail(email: string) {
    try {
      await navigator.clipboard.writeText(email)
      setActionError(null)
      setActionNotice(`Copied ${email} to clipboard.`)
    } catch {
      setActionError("Unable to copy email to clipboard")
    }
  }

  async function handleRefresh() {
    setActionError(null)
    setActionNotice(null)
    const usersResult = await usersQuery.refetch()
    const auditResult = canViewAudit ? await auditQuery.refetch() : null
    const err = usersResult.error ?? auditResult?.error
    if (err instanceof Error) setActionError(err.message)
  }

  const isFetching = usersQuery.isFetching || (canViewAudit && auditQuery.isFetching)
  const displayError =
    actionError ??
    (usersQuery.error instanceof Error ? usersQuery.error.message : null) ??
    (canViewAudit && auditQuery.error instanceof Error ? auditQuery.error.message : null)

  const normalizedCreateEmail = createEmail.trim().toLowerCase()
  const canCreateUser =
    canManageUsers &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedCreateEmail) &&
    !(usersQuery.data ?? []).some((u) => u.email === normalizedCreateEmail)

  const summary = useMemo(() => {
    const allUsers = usersQuery.data ?? []
    const admins = allUsers.filter((u) => u.role === "admin").length
    const editors = allUsers.filter((u) => u.role === "editor").length
    const viewers = allUsers.filter((u) => u.role === "viewer").length
    const verified = allUsers.filter((u) => u.is_verified).length
    return {
      total: allUsers.length,
      admins,
      editors,
      viewers,
      verified,
    }
  }, [usersQuery.data])

  const columns = useMemo<ColumnDef<DashboardManagedUser>[]>(() => [
    {
      id: "user",
      accessorKey: "email",
      header: ({ column }) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={HEADER_BUTTON_CLASS}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          User
          <ArrowUpDownIcon className="ml-1 h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => {
        const user = row.original
        const isSelf = user.email === currentUserEmail
        const isEditing = editingEmail === user.email

        return (
          <div className="py-1">
            {isEditing ? (
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                className="h-8 max-w-64 text-sm"
              />
            ) : (
              <p className="font-medium leading-tight">{user.name}</p>
            )}
            <p className="text-xs text-muted-foreground">{user.email}</p>
            {isSelf && <span className="text-xs text-primary">You</span>}
          </div>
        )
      },
    },
    {
      id: "role",
      accessorKey: "role",
      header: ({ column }) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={HEADER_BUTTON_CLASS}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Role
          <ArrowUpDownIcon className="ml-1 h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => {
        const user = row.original
        const isActing = actingEmail === user.email
        const isSelf = user.email === currentUserEmail
        const isEditing = editingEmail === user.email

        if (!isEditing) {
          return <Badge variant={ROLE_BADGE[user.role]}>{user.role}</Badge>
        }

        return (
          <Select
            value={editingRole}
            onValueChange={(value) => setEditingRole(value as UserRole)}
            disabled={isActing || isSelf}
          >
            <SelectTrigger className={SELECT_TRIGGER_CLASS} aria-label="Edit role">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      },
    },
    {
      id: "is_verified",
      accessorKey: "is_verified",
      header: ({ column }) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={HEADER_BUTTON_CLASS}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Verification
          <ArrowUpDownIcon className="ml-1 h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => {
        const user = row.original
        const isActing = actingEmail === user.email
        const isEditing = editingEmail === user.email

        if (!isEditing) {
          return user.is_verified ? (
            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <ShieldCheckIcon className="h-3.5 w-3.5" /> Verified
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <ShieldAlertIcon className="h-3.5 w-3.5" /> Unverified
            </span>
          )
        }

        return (
          <Select
            value={editingVerified ? "yes" : "no"}
            onValueChange={(value) => setEditingVerified(value === "yes")}
            disabled={isActing}
          >
            <SelectTrigger className={SELECT_TRIGGER_CLASS} aria-label="Edit verification">
              <SelectValue placeholder="Verification" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Verified</SelectItem>
              <SelectItem value="no">Unverified</SelectItem>
            </SelectContent>
          </Select>
        )
      },
    },
    {
      id: "created_at",
      accessorKey: "created_at",
      header: ({ column }) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={HEADER_BUTTON_CLASS}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Joined
          <ArrowUpDownIcon className="ml-1 h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => <RelativeDate iso={row.original.created_at} />,
    },
    {
      id: "updated_at",
      accessorKey: "updated_at",
      header: ({ column }) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={HEADER_BUTTON_CLASS}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Updated
          <ArrowUpDownIcon className="ml-1 h-3.5 w-3.5" />
        </Button>
      ),
      cell: ({ row }) => <RelativeDate iso={row.original.updated_at} />,
    },
    {
      id: "actions",
      enableSorting: false,
      header: () => <span className="text-xs font-medium text-muted-foreground">Actions</span>,
      cell: ({ row }) => {
        const user = row.original
        const isActing = actingEmail === user.email
        const isSelf = user.email === currentUserEmail
        const isEditing = editingEmail === user.email

        return (
          <div className="flex justify-end gap-1">
            <button
              type="button"
              onClick={() => void handleCopyEmail(user.email)}
              title="Copy email"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <CopyIcon className="h-3.5 w-3.5" />
            </button>
            {canManageUsers && (
              isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleSaveUser(user.email)}
                    disabled={isActing}
                    title="Save user"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600 disabled:opacity-50"
                  >
                    <SaveIcon className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={isActing}
                    title="Cancel"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-50"
                  >
                    <XIcon className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => startEdit(user)}
                    disabled={isActing}
                    title="Edit user"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(user.email, user.name)}
                    disabled={isActing || isSelf}
                    title={isSelf ? "Cannot delete your own account" : "Delete user"}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </>
              )
            )}
          </div>
        )
      },
    },
  ], [
    actingEmail,
    canManageUsers,
    currentUserEmail,
    editingEmail,
    editingName,
    editingRole,
    editingVerified,
    handleDelete,
    handleSaveUser,
  ])

  // TanStack Table returns non-memoizable functions; this usage is intentional.
  // eslint-disable-next-line react-hooks/incompatible-library
  const usersTable = useReactTable({
    data: filteredUsers,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="flex flex-col gap-6">
      {/* ── Users table card ── */}
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Users ({filteredUsers.length})</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
          >
            <RefreshCwIcon className={`mr-1.5 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            {isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 rounded-md border border-border/70 p-3 md:grid-cols-5">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total</p>
              <p className="text-base font-semibold">{summary.total}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Admins</p>
              <p className="text-base font-semibold">{summary.admins}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Editors</p>
              <p className="text-base font-semibold">{summary.editors}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Viewers</p>
              <p className="text-base font-semibold">{summary.viewers}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Verified</p>
              <p className="text-base font-semibold">{summary.verified}</p>
            </div>
          </div>

          {canManageUsers && (
            <div className="rounded-md border border-border p-3">
              <p className="mb-3 text-sm font-medium">Add User</p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
                <Input
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  placeholder="email@example.com"
                  type="email"
                  className="h-8 text-sm md:col-span-2"
                />
                <Input
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Display name"
                  className="h-8 text-sm"
                />
                <Select value={createRole} onValueChange={(value) => setCreateRole(value as UserRole)}>
                  <SelectTrigger className={SELECT_TRIGGER_CLASS} aria-label="Create role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  className="h-8"
                  onClick={handleCreateUser}
                  disabled={createMutation.isPending || !canCreateUser}
                >
                  <PlusIcon className="mr-1 h-4 w-4" />
                  {createMutation.isPending ? "Creating..." : "Create"}
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={createVerified}
                    onChange={(e) => setCreateVerified(e.target.checked)}
                  />
                  Verified
                </label>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={sendVerification}
                    onChange={(e) => setSendVerification(e.target.checked)}
                  />
                  Send verification email
                </label>
                <p className="text-xs text-muted-foreground">
                  Turn this on only when email delivery is configured; otherwise the new user will be created without a verification email.
                </p>
              </div>
            </div>
          )}

          {!canManageUsers && (
            <p className="text-xs text-muted-foreground">
              Read-only mode. Only admins can change roles or delete users.
            </p>
          )}

          {/* Filters */}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(16rem,1fr)_11rem_12rem]">
            <Input
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
            />
            <Select
              value={roleFilter}
              onValueChange={(value) => setRoleFilter(value as UserRole | "all")}
            >
              <SelectTrigger className={SELECT_TRIGGER_CLASS} aria-label="Filter by role">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {ROLE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={verifiedFilter}
              onValueChange={(value) => setVerifiedFilter(value as "all" | "yes" | "no")}
            >
              <SelectTrigger className={SELECT_TRIGGER_CLASS} aria-label="Filter by verification">
                <SelectValue placeholder="All verification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All verification</SelectItem>
                <SelectItem value="yes">Verified</SelectItem>
                <SelectItem value="no">Unverified</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {displayError && (
            <p className="text-sm text-destructive">{displayError}</p>
          )}

          {actionNotice && !displayError && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">{actionNotice}</p>
          )}

          {/* Table */}
          {usersQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users match the current filters.</p>
          ) : (
            <Table className="text-sm">
              <TableHeader>
                {usersTable.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className={header.id === "actions" ? "text-right" : ""}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {usersTable.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className={cell.column.id === "actions" ? "text-right" : ""}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Role audit log card ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Role Change History</CardTitle>
        </CardHeader>
        <CardContent>
          {!canViewAudit ? (
            <p className="text-sm text-muted-foreground">Role history is available for editor and admin roles.</p>
          ) : auditQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : (auditQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No role changes recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {(auditQuery.data ?? []).map((event, i) => (
                <div
                  key={`${event.changed_at}-${event.target_email}-${i}`}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md border border-border px-3 py-2"
                >
                  <p className="text-sm">
                    <span className="font-medium">{event.actor_email}</span>
                    {" changed "}
                    <span className="font-medium">{event.target_email}</span>
                    {" from "}
                    <Badge variant={ROLE_BADGE[event.previous_role as UserRole]} className="text-[10px]">
                      {event.previous_role}
                    </Badge>
                    {" to "}
                    <Badge variant={ROLE_BADGE[event.new_role as UserRole]} className="text-[10px]">
                      {event.new_role}
                    </Badge>
                  </p>
                  <time
                    dateTime={event.changed_at}
                    className="shrink-0 text-xs text-muted-foreground"
                  >
                    {new Date(event.changed_at).toLocaleString()}
                  </time>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
