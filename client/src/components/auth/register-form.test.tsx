// @vitest-environment jsdom

import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { RegisterForm } from "./register-form"

const pushMock = vi.fn()
const refreshMock = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
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

describe("RegisterForm", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    pushMock.mockReset()
    refreshMock.mockReset()
  })

  it("keeps submit disabled until email is provided", async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<RegisterForm />)

    const submit = screen.getByRole("button", { name: "Create account" })
    expect((submit as HTMLButtonElement).disabled).toBe(true)

    await user.type(screen.getByLabelText("Email"), "tony@example.com")
    expect((submit as HTMLButtonElement).disabled).toBe(false)
  })

  it("renders field-level api errors under email", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.mocked(fetch)

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ field: "email", message: "Email is already registered" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      })
    )

    renderWithQueryClient(<RegisterForm />)

    await user.type(screen.getByLabelText("Email"), "tony@example.com")
    await user.click(screen.getByRole("button", { name: "Create account" }))

    expect(await screen.findByText("Email is already registered")).not.toBeNull()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it("redirects to verify guidance on successful registration", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.mocked(fetch)

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, message: "Registration successful" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    )

    renderWithQueryClient(<RegisterForm />)

    await user.type(screen.getByLabelText("Email"), "tony@example.com")
    await user.click(screen.getByRole("button", { name: "Create account" }))

    expect(pushMock).toHaveBeenCalledWith("/verify?source=register&email=tony%40example.com")
  })
})
