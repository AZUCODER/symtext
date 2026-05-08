// @vitest-environment jsdom

import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import VerifyPage from "./page"

const pushMock = vi.fn()
const refreshMock = vi.fn()
const signInMock = vi.fn()
const resendVerificationEmailMock = vi.fn()

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

vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => signInMock(...args),
}))

vi.mock("@/lib/auth-client", () => ({
  resendVerificationEmail: (...args: unknown[]) => resendVerificationEmailMock(...args),
}))

vi.mock("@/lib/auth-toast", () => ({
  authToast: {
    verifyMissingToken: vi.fn(),
    verifyLoading: vi.fn(),
    verifySuccess: vi.fn(),
    verifyError: vi.fn(),
    resendLoading: vi.fn(),
    resendSuccess: vi.fn(),
    resendError: vi.fn(),
  },
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

describe("VerifyPage registration guidance", () => {
  beforeEach(() => {
    searchParamValues = {}
    signInMock.mockResolvedValue({})
    resendVerificationEmailMock.mockResolvedValue({ message: "Verification email sent" })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    pushMock.mockReset()
    refreshMock.mockReset()
    signInMock.mockReset()
    resendVerificationEmailMock.mockReset()
  })

  it("shows check-email guidance state for newly registered users", async () => {
    searchParamValues = {
      source: "register",
      email: "newuser@example.com",
    }

    renderWithQueryClient(<VerifyPage />)

    expect(
      await screen.findByText("Check newuser@example.com for your verification link to complete registration.")
    ).not.toBeNull()
    expect(screen.getByRole("button", { name: "Resend verification email" })).not.toBeNull()
    expect(screen.getByRole("button", { name: "Use another email" })).not.toBeNull()
    expect(signInMock).not.toHaveBeenCalled()
  })

  it("resends verification email from guidance state", async () => {
    const user = userEvent.setup()

    searchParamValues = {
      source: "register",
      email: "newuser@example.com",
    }

    renderWithQueryClient(<VerifyPage />)

    await user.click(await screen.findByRole("button", { name: "Resend verification email" }))

    expect(resendVerificationEmailMock).toHaveBeenCalledTimes(1)
    expect(resendVerificationEmailMock).toHaveBeenCalledWith({ email: "newuser@example.com" })
  })
})
