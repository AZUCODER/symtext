import type { uploadFileToOss } from "@/lib/media-client"

type OssMediaType = Parameters<typeof uploadFileToOss>[0]["mediaType"]

const FALLBACK_UPLOAD_ERROR_MESSAGE =
  "Upload failed. Please try again with a smaller file or check your network connection."

export function getBlocknoteUploadMediaType(fileType: string): OssMediaType {
  if (fileType.startsWith("image/")) {
    return "image"
  }

  if (fileType.startsWith("video/")) {
    return "video"
  }

  if (fileType.startsWith("audio/")) {
    return "audio"
  }

  return "file"
}

export function getBlocknoteUploadFolder(mediaType: OssMediaType): string {
  switch (mediaType) {
    case "image":
      return "blog-content-image"
    case "video":
      return "blog-content-video"
    case "audio":
      return "blog-content-audio"
    default:
      return "blog-content-file"
  }
}

export function getBlocknoteUploadErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return `Upload failed: ${error.message}`
  }

  return FALLBACK_UPLOAD_ERROR_MESSAGE
}
