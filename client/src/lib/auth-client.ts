type ApiMessage = {
  message?: string
  detail?: string
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    cache: "no-store",
  })

  const payload = (await response.json().catch(() => null)) as (T & ApiMessage) | null

  if (!response.ok) {
    throw new Error(payload?.message ?? payload?.detail ?? "Request failed")
  }

  return payload as T
}

export type RegisterErrorResponse = {
  message?: string
  field?: "email" | "form"
}

export class RegisterRequestError extends Error {
  field?: RegisterErrorResponse["field"]

  constructor(message: string, field?: RegisterErrorResponse["field"]) {
    super(message)
    this.name = "RegisterRequestError"
    this.field = field
  }
}

export function registerWithEmail(payload: {
  email: string
}): Promise<{ message?: string }> {
  return fetch("/api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  }).then(async (response) => {
    const body = (await response.json().catch(() => null)) as RegisterErrorResponse | null

    if (!response.ok) {
      throw new RegisterRequestError(body?.message ?? "Registration failed", body?.field)
    }

    return { message: body?.message }
  })
}

export function requestEmailLoginChallenge(payload: {
  email: string
  next?: string
}): Promise<{ message?: string }> {
  return requestJson<{ message?: string }>("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
}

export function resendVerificationEmail(payload: {
  email: string
}): Promise<{ message?: string }> {
  return requestJson<{ message?: string }>("/api/auth/resend-verification", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
}

export function verifyEmailToken(payload: {
  token: string
}): Promise<{
  access_token: string
  refresh_token: string
  token_type: string
  user: {
    name: string
    email: string
    role: "viewer" | "editor" | "admin"
    is_verified: boolean
  }
}> {
  return requestJson<{
    access_token: string
    refresh_token: string
    token_type: string
    user: {
      name: string
      email: string
      role: "viewer" | "editor" | "admin"
      is_verified: boolean
    }
  }>("/api/auth/verify-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
}
