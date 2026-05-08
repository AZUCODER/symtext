"use client"

import { useEffect, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useSearchParams, useRouter } from "next/navigation"

import { authToast } from "@/lib/auth-toast"
import { normalizeEmail, validateEmail } from "@/lib/auth-email"
import { requestEmailLoginChallenge, resendVerificationEmail } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type LoginFieldKey = "email"
type LoginFieldErrors = Partial<Record<LoginFieldKey, string>>
type LoginTouchedState = Record<LoginFieldKey, boolean>

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialEmail = searchParams.get("email") ?? ""
  const initialInfo = searchParams.get("verify") === "sent"
    ? "Check your inbox for a verification link to finish signing in."
    : null

  const [email, setEmail] = useState(initialEmail)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(initialInfo)
  const [challengeRequested, setChallengeRequested] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({})
  const [touched, setTouched] = useState<LoginTouchedState>({
    email: false,
  })

  // Cross-tab sync: when the user clicks the magic link in a new browser tab,
  // that tab posts a BroadcastChannel message after authenticating. Redirect
  // this stale login tab to the dashboard immediately.
  useEffect(() => {
    const channel = new BroadcastChannel("symtext.auth")

    function onMessage(event: MessageEvent<{ type?: string; destination?: string }>) {
      if (event.data?.type !== "verified") return
      const next = searchParams.get("next")
      const destination = event.data.destination ?? (next && next.startsWith("/") ? next : "/dashboard")
      router.replace(destination)
    }

    channel.addEventListener("message", onMessage)
    return () => {
      channel.removeEventListener("message", onMessage)
      channel.close()
    }
  }, [router, searchParams])

  const normalizedEmail = normalizeEmail(email)
  const canSubmit = normalizedEmail.length > 0
  const emailErrorId = "login-email-error"
  const emailInlineError = getInlineError("email")
  const hasInlineError = Boolean(emailInlineError)

  const loginMutation = useMutation({
    mutationFn: () => requestEmailLoginChallenge({
      email: normalizedEmail,
      next: searchParams.get("next") ?? undefined,
    }),
  })

  const resendVerificationMutation = useMutation({
    mutationFn: () => resendVerificationEmail({ email: normalizedEmail }),
  })

  function markTouched(field: LoginFieldKey) {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  function getInlineError(field: LoginFieldKey): string | null {
    if (!touched[field]) {
      return null
    }

    return fieldErrors[field] ?? null
  }

  function onEmailChange(value: string) {
    setEmail(value)
    setError(null)
    setInfo((prev) => (challengeRequested ? prev : null))

    if (!touched.email) {
      return
    }

    setFieldErrors((prev) => ({
      ...prev,
      email: validateEmail(value) ?? undefined,
    }))
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    setTouched({ email: true })
    setFieldErrors({})

    const emailValidationError = validateEmail(normalizedEmail)
    if (emailValidationError) {
      setFieldErrors({ email: emailValidationError })
      return
    }

    setIsSubmitting(true)
    authToast.loginChallengeLoading()

    try {
      const payload = await loginMutation.mutateAsync()
      const message = payload?.message ?? "If the email can be used for this action, a verification link was sent"
      setChallengeRequested(true)
      setInfo(message)
      authToast.loginChallengeSent(message)
    } catch {
      const message = "An unexpected error occurred. Please try again."
      setError(message)
      authToast.loginChallengeError()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function onResendVerification() {
    if (!normalizedEmail) {
      setTouched((prev) => ({ ...prev, email: true }))
      setFieldErrors((prev) => ({ ...prev, email: "Please enter your email address" }))
      return
    }

    const emailValidationError = validateEmail(normalizedEmail)
    if (emailValidationError) {
      setTouched((prev) => ({ ...prev, email: true }))
      setFieldErrors((prev) => ({ ...prev, email: emailValidationError }))
      return
    }

    setError(null)
    setInfo(null)
    authToast.resendLoading()

    try {
      const payload = await resendVerificationMutation.mutateAsync()

      const successMessage = payload?.message ?? "Verification email sent"
      setInfo(successMessage)
      authToast.resendSuccess(successMessage)
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Could not resend verification"
      setError(message)
      authToast.resendError(message)
    }
  }

  return (
    <div className={cn("flex flex-col gap-7", className)} {...props}>
      <Card className="rounded-xl bg-card/95 py-6 shadow-lg ring-1 ring-foreground/8">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl md:text-[1.75rem]">Welcome back</CardTitle>
          <CardDescription className="text-base">
            Sign in with your email only
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 md:px-7">
          <form onSubmit={onSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  value={email}
                  onChange={(event) => onEmailChange(event.target.value)}
                  onBlur={() => {
                    markTouched("email")
                    setFieldErrors((prev) => ({
                      ...prev,
                      email: validateEmail(email) ?? undefined,
                    }))
                  }}
                  aria-invalid={Boolean(getInlineError("email"))}
                  aria-describedby={getInlineError("email") ? emailErrorId : undefined}
                  required
                />
                {getInlineError("email") ? <FieldError id={emailErrorId}>{getInlineError("email")}</FieldError> : null}
              </Field>
              <Field>
                {error && !hasInlineError ? (
                  <FieldDescription className="text-center text-destructive">{error}</FieldDescription>
                ) : null}
                {info ? <FieldDescription className="text-center text-foreground/80">{info}</FieldDescription> : null}
                {challengeRequested ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={resendVerificationMutation.isPending}
                    onClick={onResendVerification}
                  >
                    {resendVerificationMutation.isPending ? "Sending verification..." : "Resend verification email"}
                  </Button>
                ) : null}
                <Button type="submit" className="w-full" disabled={isSubmitting || !canSubmit}>
                  {isSubmitting ? "Sending link..." : "Send login link"}
                </Button>
                <FieldDescription className="pt-1 text-center">
                  Don&apos;t have an account? <a href="/register">Sign up</a>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-4 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  )
}
