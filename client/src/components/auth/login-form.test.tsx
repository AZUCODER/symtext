// @vitest-environment jsdom

import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { LoginForm } from "./login-form"

const pushMock = vi.fn()
const refreshMock = vi.fn()
let searchParamValues: Record<string, string | null> = {}

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
  useSearchParams: () => ({
    get: (key: string) => searchParamValues[key] ?? null,
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

describe("LoginForm", () => {
  beforeEach(() => {
    searchParamValues = {}
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    pushMock.mockReset()
    refreshMock.mockReset()
  })

  it("prefills email and shows verification-sent hint from query params", () => {
    searchParamValues = {
      email: "tony@example.com",
      verify: "sent",
    }

    renderWithQueryClient(<LoginForm />)

    const emailInput = screen.getByLabelText("Email") as HTMLInputElement
    expect(emailInput.value).toBe("tony@example.com")
    expect(
      screen.getByText("Check your inbox for a verification link to finish signing in.")
    ).not.toBeNull()
  })

  it("submits email challenge request", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.mocked(fetch)

    searchParamValues = {
      next: "/dashboard?tab=users",
    }

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Verification link sent" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )

    renderWithQueryClient(<LoginForm />)

    await user.type(screen.getByLabelText("Email"), "tony@example.com")
    await user.click(screen.getByRole("button", { name: "Send login link" }))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({ method: "POST" })
    )
    expect(await screen.findByText("Verification link sent")).not.toBeNull()
  })

  it("shows field-level email errors during interaction", async () => {
    const user = userEvent.setup()

    renderWithQueryClient(<LoginForm />)

    const emailInput = screen.getByLabelText("Email")

    await user.click(emailInput)
    await user.tab()

    expect(await screen.findByText("Please enter your email address")).not.toBeNull()

    await user.type(emailInput, "bad-email")
    await user.tab()

    expect(await screen.findByText("Please enter a valid email address")).not.toBeNull()
  })

  it("shows resend verification action after challenge request and handles resend", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.mocked(fetch)

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Verification link sent" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Verification email sent" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )

    renderWithQueryClient(<LoginForm />)

    await user.type(screen.getByLabelText("Email"), "tony@example.com")
    await user.click(screen.getByRole("button", { name: "Send login link" }))

    const resendButton = await screen.findByRole("button", { name: "Resend verification email" })
    await user.click(resendButton)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/auth/resend-verification",
      expect.objectContaining({ method: "POST" })
    )
    expect(await screen.findByText("Verification email sent")).not.toBeNull()
  })
})
