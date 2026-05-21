type ValidationDetailItem = {
  loc?: unknown
  msg?: unknown
  type?: unknown
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function formatValidationLocation(loc: unknown): string {
  if (!Array.isArray(loc)) {
    return ""
  }

  const tokens = loc
    .filter((token) => typeof token === "string" || typeof token === "number")
    .map((token) => String(token))
    .filter((token) => token !== "body")

  return tokens.length > 0 ? `${tokens.join(".")}: ` : ""
}

function formatDetail(detail: unknown): string | null {
  if (typeof detail === "string" && detail.trim().length > 0) {
    return detail
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (!isPlainObject(item)) {
          return null
        }

        const typed = item as ValidationDetailItem
        if (typeof typed.msg !== "string" || typed.msg.trim().length === 0) {
          return null
        }

        return `${formatValidationLocation(typed.loc)}${typed.msg}`
      })
      .filter((message): message is string => Boolean(message))

    if (messages.length > 0) {
      return messages.join("; ")
    }
  }

  if (isPlainObject(detail) && typeof detail.message === "string" && detail.message.trim().length > 0) {
    return detail.message
  }

  return null
}

export function extractApiErrorMessage(payload: unknown, fallback: string): string {
  if (!isPlainObject(payload)) {
    return fallback
  }

  if (typeof payload.message === "string" && payload.message.trim().length > 0) {
    return payload.message
  }

  const fromDetail = formatDetail(payload.detail)
  if (fromDetail) {
    return fromDetail
  }

  return fallback
}
