// @vitest-environment jsdom

import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { NavUser } from "./nav-user"
import { SidebarProvider } from "@/components/ui/sidebar"

const signOutMock = vi.fn()

vi.mock("next-auth/react", () => ({
  signOut: (...args: unknown[]) => signOutMock(...args),
}))

describe("NavUser", () => {
  beforeEach(() => {
    signOutMock.mockReset()
    signOutMock.mockResolvedValue(undefined)
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("logs out from dropdown menu and routes to login", async () => {
    const user = userEvent.setup()

    render(
      <SidebarProvider>
        <NavUser
          user={{
            name: "Tony Stark",
            email: "tony@example.com",
            avatar: "",
          }}
        />
      </SidebarProvider>
    )

    await user.click(screen.getByRole("button", { name: /tony stark/i }))
    await user.click(await screen.findByRole("menuitem", { name: "Log out" }))

    expect(signOutMock).toHaveBeenCalledTimes(1)
    expect(signOutMock).toHaveBeenCalledWith({ callbackUrl: "/login?logout=1" })
  })
})
