import { NextResponse } from "next/server"

import { parseRequestJson, postAuthProxy } from "@/app/api/auth/_lib/proxy"

type RegisterBody = {
  email?: string
}

type ValidationDetailItem = {
  loc?: Array<string | number>
  msg?: string
}

type ErrorPayload = {
  detail?: string | ValidationDetailItem[]
  message?: string
}

type RegisterErrorField = "email" | "form"

type RegisterErrorResult = {
  message: string
  field: RegisterErrorField
}

function getFieldName(detail: ValidationDetailItem): string | null {
  if (!detail.loc || detail.loc.length === 0) {
    return null
  }

  const last = detail.loc[detail.loc.length - 1]
  return typeof last === "string" ? last : null
}

function mapValidationDetailToMessage(detail: ValidationDetailItem): RegisterErrorResult {
  const message = detail.msg?.trim() ?? ""
  const fieldName = getFieldName(detail)

  if (fieldName === "email") {
    return { message: "Please enter a valid email address", field: "email" }
  }

  return { message: message || "Please check your input and try again", field: "form" }
}

function getRegisterError(payload: ErrorPayload | null): RegisterErrorResult {
  if (!payload) {
    return { message: "Registration failed", field: "form" }
  }

  if (typeof payload.detail === "string" && payload.detail.trim()) {
    if (payload.detail.toLowerCase().includes("already registered")) {
      return { message: payload.detail, field: "email" }
    }

    return { message: payload.detail, field: "form" }
  }

  if (Array.isArray(payload.detail) && payload.detail.length > 0) {
    const firstError = payload.detail[0]
    if (firstError) {
      return mapValidationDetailToMessage(firstError)
    }
  }

  if (payload.message?.trim()) {
    if (payload.message.toLowerCase().includes("already registered")) {
      return { message: payload.message, field: "email" }
    }

    return { message: payload.message, field: "form" }
  }

  return { message: "Registration failed", field: "form" }
}

export async function POST(request: Request) {
  const body = await parseRequestJson<RegisterBody>(request)
  const { response, payload } = await postAuthProxy<ErrorPayload>("/auth/register", {
    email: body.email,
  })

  if (!response.ok) {
    const registerError = getRegisterError(payload)
    return NextResponse.json(registerError, { status: response.status || 400 })
  }

  return NextResponse.json({ ok: true, message: payload?.message ?? "Registration successful" }, { status: 201 })
}
