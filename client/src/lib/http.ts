type HeaderMap = Record<string, string>

export function withJsonHeaders(headers?: HeaderMap): HeaderMap {
  return {
    "Content-Type": "application/json",
    ...(headers ?? {}),
  }
}

export function withBearerHeaders(token: string, headers?: HeaderMap): HeaderMap {
  return {
    Authorization: `Bearer ${token}`,
    ...(headers ?? {}),
  }
}
