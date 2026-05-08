import { NextResponse } from "next/server"

import { getApiErrorMessage, parseRequestJson, postAuthProxy } from "@/app/api/auth/_lib/proxy"

type VerifyBody = {
  token?: string
}

export async function POST(request: Request) {
  const body = await parseRequestJson<VerifyBody>(request)
  const { response, payload } = await postAuthProxy<{
    access_token?: string
    refresh_token?: string
    token_type?: string
    user?: {
      name: string
      email: string
      role: "viewer" | "editor" | "admin"
      is_verified: boolean
    }
    message?: string
    detail?: string
  }>("/auth/verify-email", { token: body.token })

  if (!response.ok) {
    return NextResponse.json(
      { message: getApiErrorMessage(payload, "Verification failed") },
      { status: response.status || 400 }
    )
  }

  return NextResponse.json(
    {
      access_token: payload?.access_token,
      refresh_token: payload?.refresh_token,
      token_type: payload?.token_type,
      user: payload?.user,
    },
    { status: 200 }
  )
}
