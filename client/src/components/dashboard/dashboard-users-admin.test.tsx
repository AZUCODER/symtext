// @vitest-environment jsdom

import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { DashboardUsersAdmin } from "./dashboard-users-admin"

const getAdminUsersMock = vi.fn()
const getRoleAuditMock = vi.fn()
const createAdminUserMock = vi.fn()
const updateAdminUserMock = vi.fn()
const deleteUserMock = vi.fn()

vi.mock("@/lib/dashboard-admin-client", () => ({
  getAdminUsers: (...args: unknown[]) => getAdminUsersMock(...args),
  getRoleAudit: (...args: unknown[]) => getRoleAuditMock(...args),
  createAdminUser: (...args: unknown[]) => createAdminUserMock(...args),
  updateAdminUser: (...args: unknown[]) => updateAdminUserMock(...args),
  deleteUser: (...args: unknown[]) => deleteUserMock(...args),
}))

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  )
}

describe("DashboardUsersAdmin", () => {
  beforeEach(() => {
    getAdminUsersMock.mockResolvedValue([
      {
        name: "Alice Admin",
        email: "alice@example.com",
        role: "admin",
        is_verified: true,
        created_at: new Date("2026-01-01T10:00:00Z").toISOString(),
        updated_at: new Date("2026-01-01T10:00:00Z").toISOString(),
      },
      {
        name: "Victor Viewer",
        email: "victor@example.com",
        role: "viewer",
        is_verified: false,
        created_at: new Date("2026-01-02T10:00:00Z").toISOString(),
        updated_at: new Date("2026-01-02T10:00:00Z").toISOString(),
      },
    ])
    getRoleAuditMock.mockResolvedValue([])
    createAdminUserMock.mockReset()
    createAdminUserMock.mockImplementation(async (payload: {
      email: string
      name?: string | null
      role?: "viewer" | "editor" | "admin"
      is_verified?: boolean
    }) => ({
      name: payload.name ?? payload.email.split("@")[0],
      email: payload.email,
      role: payload.role ?? "viewer",
      is_verified: payload.is_verified ?? false,
      created_at: new Date("2026-01-03T10:00:00Z").toISOString(),
      updated_at: new Date("2026-01-03T10:00:00Z").toISOString(),
    }))
    updateAdminUserMock.mockReset()
    updateAdminUserMock.mockImplementation(async (email: string, payload: {
      name?: string
      role?: "viewer" | "editor" | "admin"
      is_verified?: boolean
    }) => ({
      name: payload.name ?? "Updated Name",
      email,
      role: payload.role ?? "viewer",
      is_verified: payload.is_verified ?? false,
      created_at: new Date("2026-01-01T10:00:00Z").toISOString(),
      updated_at: new Date("2026-01-04T10:00:00Z").toISOString(),
    }))
    deleteUserMock.mockReset()
    deleteUserMock.mockResolvedValue(undefined)
    vi.stubGlobal("confirm", vi.fn(() => true))
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("shows add user and row actions for admin users", async () => {
    renderWithQueryClient(
      <DashboardUsersAdmin
        currentUserEmail="alice@example.com"
        currentUserRole="admin"
      />
    )

    expect(await screen.findByText("Add User")).not.toBeNull()
    expect((await screen.findAllByTitle("Edit user")).length).toBeGreaterThan(0)
    expect((await screen.findAllByTitle("Delete user")).length).toBeGreaterThan(0)
  })

  it("shows read-only message and hides add/edit/delete controls for viewer", async () => {
    renderWithQueryClient(
      <DashboardUsersAdmin
        currentUserEmail="victor@example.com"
        currentUserRole="viewer"
      />
    )

    expect(
      await screen.findByText("Read-only mode. Only admins can change roles or delete users.")
    ).not.toBeNull()
    expect(screen.queryByText("Add User")).toBeNull()
    expect(screen.queryByTitle("Edit user")).toBeNull()
    expect(screen.queryByTitle("Delete user")).toBeNull()
  })

  it("creates a new user and shows success feedback", async () => {
    const user = userEvent.setup()

    renderWithQueryClient(
      <DashboardUsersAdmin
        currentUserEmail="alice@example.com"
        currentUserRole="admin"
      />
    )

    await screen.findByText("Add User")
    await user.type(screen.getByPlaceholderText("email@example.com"), "new.user@example.com")
    await user.type(screen.getByPlaceholderText("Display name"), "New User")
    await user.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(createAdminUserMock).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "new.user@example.com",
          name: "New User",
          role: "viewer",
        })
      )
    })

    expect(await screen.findByText("User new.user@example.com created successfully.")).not.toBeNull()
  })

  it("updates an existing user and shows success feedback", async () => {
    const user = userEvent.setup()

    renderWithQueryClient(
      <DashboardUsersAdmin
        currentUserEmail="alice@example.com"
        currentUserRole="admin"
      />
    )

    const rowEmail = await screen.findByText("victor@example.com")
    const row = rowEmail.closest("tr") as HTMLTableRowElement
    const rowScope = within(row)
    await user.click(rowScope.getByTitle("Edit user"))

    const nameInput = screen.getByDisplayValue("Victor Viewer")
    await user.clear(nameInput)
    await user.type(nameInput, "Victor Updated")

    await user.click(rowScope.getByTitle("Save user"))

    await waitFor(() => {
      expect(updateAdminUserMock).toHaveBeenCalledWith(
        "victor@example.com",
        expect.objectContaining({
          role: "viewer",
        })
      )
    })

    expect(await screen.findByText("User victor@example.com updated successfully.")).not.toBeNull()
  })

  it("deletes an existing user and removes row", async () => {
    const user = userEvent.setup()

    renderWithQueryClient(
      <DashboardUsersAdmin
        currentUserEmail="alice@example.com"
        currentUserRole="admin"
      />
    )

    expect(await screen.findByText("victor@example.com")).not.toBeNull()

    const deleteButtons = await screen.findAllByTitle("Delete user")
    await user.click(deleteButtons[0])

    await waitFor(() => {
      expect(deleteUserMock).toHaveBeenCalledWith("victor@example.com")
    })

    await waitFor(() => {
      expect(screen.queryByText("victor@example.com")).toBeNull()
    })
    expect(await screen.findByText("User victor@example.com deleted successfully.")).not.toBeNull()
  })
})
