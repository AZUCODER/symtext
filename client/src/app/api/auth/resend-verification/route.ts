import { NextResponse } from "next/server"

import { getApiErrorMessage, parseRequestJson, postAuthProxy } from "@/app/api/auth/_lib/proxy"

type ResendBody = {
  email?: string
}

export async function POST(request: Request) {
  const body = await parseRequestJson<ResendBody>(request)
  const { response, payload } = await postAuthProxy<{ message?: string; detail?: string }>(
    "/auth/resend-verification",
    { email: body.email }
  )

  if (!response.ok) {
    return NextResponse.json(
      { message: getApiErrorMessage(payload, "Could not resend verification") },
      { status: response.status || 400 }
    )
  }

  return NextResponse.json(
    { message: payload?.message ?? "If the email can be used for this action, a verification link was sent" },
    { status: 200 }
  )
}
