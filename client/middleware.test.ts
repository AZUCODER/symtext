import { describe, expect, it, vi } from "vitest"

vi.mock("@/auth", () => ({
  auth: (handler: (request: unknown) => unknown) => handler,
}))

import middleware from "./middleware"

describe("dashboard middleware", () => {
  it("redirects unauthenticated users to login with next parameter", () => {
    const response = middleware({
      auth: null,
      url: "http://localhost:3000/dashboard/settings?tab=users",
      nextUrl: {
        pathname: "/dashboard/settings",
        search: "?tab=users",
      },
    } as never)

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?next=%2Fdashboard%2Fsettings%3Ftab%3Dusers"
    )
    expect(response.status).toBe(307)
  })

  it("allows authenticated users", () => {
    const response = middleware({
      auth: {
        user: { email: "tony@example.com" },
      },
      url: "http://localhost:3000/dashboard",
      nextUrl: {
        pathname: "/dashboard",
        search: "",
      },
    } as never)

    expect(response.status).toBe(200)
    expect(response.headers.get("location")).toBeNull()
  })
})
