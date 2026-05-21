import { describe, expect, it } from "vitest"

import {
  getBlocknoteUploadFolder,
  getBlocknoteUploadMediaType,
  getBlocknoteUploadErrorMessage,
} from "@/lib/blocknote-upload"

describe("getBlocknoteUploadMediaType", () => {
  it("maps mime types to OSS media types", () => {
    expect(getBlocknoteUploadMediaType("image/png")).toBe("image")
    expect(getBlocknoteUploadMediaType("video/mp4")).toBe("video")
    expect(getBlocknoteUploadMediaType("audio/mpeg")).toBe("audio")
    expect(getBlocknoteUploadMediaType("application/pdf")).toBe("file")
    expect(getBlocknoteUploadMediaType("")).toBe("file")
  })
})

describe("getBlocknoteUploadFolder", () => {
  it("returns media-specific blog content folders", () => {
    expect(getBlocknoteUploadFolder("image")).toBe("blog-content-image")
    expect(getBlocknoteUploadFolder("video")).toBe("blog-content-video")
    expect(getBlocknoteUploadFolder("audio")).toBe("blog-content-audio")
    expect(getBlocknoteUploadFolder("file")).toBe("blog-content-file")
  })
})

describe("getBlocknoteUploadErrorMessage", () => {
  it("returns a user-friendly message when upload fails", () => {
    expect(getBlocknoteUploadErrorMessage(new Error("network timeout"))).toBe(
      "Upload failed: network timeout"
    )
    expect(getBlocknoteUploadErrorMessage("oops")).toBe(
      "Upload failed. Please try again with a smaller file or check your network connection."
    )
  })
})
