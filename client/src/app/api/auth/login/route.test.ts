import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createJsonResponse } from "@/app/api/auth/_lib/test-utils"
import { POST } from "./route"

describe("POST /api/auth/login", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("returns the generic challenge message", async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse(200, {
        message: "If the email can be used for this action, a verification link was sent",
      })
    )

    const request = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "tony@example.com", next: "/dashboard" }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      message: "If the email can be used for this action, a verification link was sent",
    })
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/auth/login",
      expect.objectContaining({ method: "POST" })
    )
  })

  it("maps upstream errors", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse(500, { detail: "Email provider is not configured" }))

    const request = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "tony@example.com" }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload).toEqual({ message: "Email provider is not configured" })
  })
})
