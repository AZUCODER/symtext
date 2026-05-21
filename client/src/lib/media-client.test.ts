import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { toAbsoluteHttpUrl, uploadFileToOss } from "@/lib/media-client"

describe("toAbsoluteHttpUrl", () => {
  it("returns absolute URLs unchanged", () => {
    expect(toAbsoluteHttpUrl("https://example.com/a.png")).toBe("https://example.com/a.png")
  })

  it("resolves relative paths with an explicit base URL", () => {
    expect(toAbsoluteHttpUrl("/api/media/oss/object?key=abc", "https://symtext.com")).toBe(
      "https://symtext.com/api/media/oss/object?key=abc"
    )
  })

  it("returns the original non-http value when it cannot be normalized", () => {
    expect(toAbsoluteHttpUrl("not-a-url")).toBe("not-a-url")
  })
})

describe("uploadFileToOss", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("returns an absolute same-origin OSS proxy URL after upload", async () => {
    vi.stubGlobal("window", {
      location: { origin: "https://symtext.com" },
    })

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          method: "PUT",
          upload_url: "https://oss-upload-url",
          object_key: "uploads/image/blog-cover/2026/05/16/demo.jpg",
          public_url: "https://bucket.example.com/uploads/image/blog-cover/2026/05/16/demo.jpg",
          expires_in_seconds: 600,
          max_upload_bytes: 10_000_000,
          headers: { "Content-Type": "image/jpeg" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }))

    const file = new File(["binary"], "demo.jpg", { type: "image/jpeg" })
    const uploaded = await uploadFileToOss({ file, mediaType: "image", folder: "blog-cover" })

    expect(uploaded.objectKey).toBe("uploads/image/blog-cover/2026/05/16/demo.jpg")
    expect(uploaded.publicUrl).toBe(
      "https://symtext.com/api/media/oss/object?key=uploads%2Fimage%2Fblog-cover%2F2026%2F05%2F16%2Fdemo.jpg"
    )
  })
})
