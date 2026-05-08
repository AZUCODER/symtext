import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createJsonResponse } from "@/app/api/auth/_lib/test-utils"
import { POST } from "./route"

describe("POST /api/auth/register", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("maps FastAPI email validation errors to a field-level message", async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse(422, {
        detail: [{ loc: ["body", "email"], msg: "value is not a valid email address" }],
      })
    )

    const request = new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "bad" }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(422)
    expect(payload).toEqual({
      message: "Please enter a valid email address",
      field: "email",
    })
  })

  it("marks duplicate email errors as email field errors", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse(409, { detail: "Email is already registered" }))

    const request = new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "flowtest952309@example.com",
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(409)
    expect(payload).toEqual({
      message: "Email is already registered",
      field: "email",
    })
  })

  it("returns success payload and status on successful registration", async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse(201, {
        message: "Registration successful. Check your inbox to verify your email.",
      })
    )

    const request = new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "flowtest123@example.com",
      }),
    })

    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload).toEqual({
      ok: true,
      message: "Registration successful. Check your inbox to verify your email.",
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/auth/register",
      expect.objectContaining({ method: "POST" })
    )
  })
})
