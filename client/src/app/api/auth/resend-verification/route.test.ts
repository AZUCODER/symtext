import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createJsonResponse } from "@/app/api/auth/_lib/test-utils"
import { POST } from "./route"

describe("POST /api/auth/resend-verification", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("returns a generic success-style message for unknown users", async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse(200, {
        message: "If the email can be used for this action, a verification link was sent",
      })
    )

    const request = new Request("http://localhost:3000/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "unknown@example.com" }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      message: "If the email can be used for this action, a verification link was sent",
    })
  })

  it("maps upstream errors to frontend-friendly message", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse(400, { detail: "Could not resend verification" }))

    const request = new Request("http://localhost:3000/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "bad-email" }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({ message: "Could not resend verification" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/auth/resend-verification",
      expect.objectContaining({ method: "POST" })
    )
  })
})
