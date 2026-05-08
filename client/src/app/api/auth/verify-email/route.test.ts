import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createJsonResponse } from "@/app/api/auth/_lib/test-utils"
import { POST } from "./route"

describe("POST /api/auth/verify-email", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("returns token payload from backend verification", async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse(200, {
        access_token: "access",
        refresh_token: "refresh",
        token_type: "bearer",
        user: {
          name: "tony",
          email: "tony@example.com",
          role: "viewer",
          is_verified: true,
        },
      })
    )

    const request = new Request("http://localhost:3000/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "verification-token" }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      access_token: "access",
      refresh_token: "refresh",
      token_type: "bearer",
      user: {
        name: "tony",
        email: "tony@example.com",
        role: "viewer",
        is_verified: true,
      },
    })
  })

  it("maps verification errors", async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse(401, {
        detail: "Verification token is invalid, expired, or already used",
      })
    )

    const request = new Request("http://localhost:3000/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "bad" }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({ message: "Verification token is invalid, expired, or already used" })
  })
})
