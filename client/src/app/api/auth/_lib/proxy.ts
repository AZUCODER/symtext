import { API_BASE_URL } from "@/app/api/_lib/auth"

export type ApiMessagePayload = {
  message?: string
  detail?: string
}

export async function parseRequestJson<TBody>(request: Request): Promise<TBody> {
  return (await request.json().catch(() => ({}))) as TBody
}

export async function postAuthProxy<TPayload = ApiMessagePayload>(
  path: string,
  body: unknown
): Promise<{ response: Response; payload: TPayload | null }> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  })

  const payload = (await response.json().catch(() => null)) as TPayload | null
  return { response, payload }
}

export function getApiErrorMessage(
  payload: ApiMessagePayload | null,
  fallbackMessage: string
): string {
  return payload?.detail ?? payload?.message ?? fallbackMessage
}
