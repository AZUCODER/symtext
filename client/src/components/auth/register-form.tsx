"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"

import { authToast } from "@/lib/auth-toast"
import { registerWithEmail, RegisterRequestError } from "@/lib/auth-client"
import { normalizeEmail, validateEmail } from "@/lib/auth-email"
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

type RegisterFieldKey = "email"
type RegisterFieldErrors = Partial<Record<RegisterFieldKey, string>>
type RegisterTouchedState = Record<RegisterFieldKey, boolean>

export function RegisterForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({})
  const [touched, setTouched] = useState<RegisterTouchedState>({
    email: false,
  })

  const normalizedEmail = normalizeEmail(email)
  const registerMutation = useMutation({
    mutationFn: () => registerWithEmail({ email: normalizedEmail }),
  })

  const canSubmit = normalizedEmail.length > 0
  const emailErrorId = "register-email-error"

  function markTouched(field: RegisterFieldKey) {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  function getInlineError(field: RegisterFieldKey): string | null {
    if (!touched[field]) {
      return null
    }

    return fieldErrors[field] ?? null
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setTouched({ email: true })
    setFieldErrors({})

    const emailError = validateEmail(normalizedEmail, "Email is required")
    if (emailError) {
      setFieldErrors({ email: emailError })
      return
    }

    authToast.registerLoading()

    try {
      await registerMutation.mutateAsync()
      authToast.registerSuccess("Registration email sent. Check your inbox to verify your email.")
      router.push(`/verify?source=register&email=${encodeURIComponent(normalizedEmail)}`)
    } catch (submitError) {
      if (submitError instanceof RegisterRequestError && submitError.field && submitError.field !== "form") {
        setFieldErrors({ email: submitError.message ?? "Please check this field" })
        authToast.registerFieldError(submitError.message ?? "Please check the highlighted field")
        return
      }

      const message = submitError instanceof Error ? submitError.message : "Registration failed"
      setError(message)
      authToast.registerError(message)
    }
  }

  return (
    <div className={cn("flex flex-col gap-4", className)} {...props}>
      <Card className="rounded-xl bg-card/95 py-4 shadow-lg ring-1 ring-foreground/8">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl md:text-[1.75rem]">Create an account</CardTitle>
          <CardDescription>
            Sign up with your email
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5 md:px-6">
          <form onSubmit={onSubmit}>
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  onBlur={() => {
                    markTouched("email")
                    setFieldErrors({ email: validateEmail(email, "Email is required") ?? undefined })
                  }}
                  aria-invalid={Boolean(getInlineError("email"))}
                  aria-describedby={getInlineError("email") ? emailErrorId : undefined}
                  required
                />
                {getInlineError("email") ? <FieldError id={emailErrorId}>{getInlineError("email")}</FieldError> : null}
              </Field>
              <Field>
                {error ? (
                  <FieldDescription className="text-center text-destructive">{error}</FieldDescription>
                ) : null}
                <Button type="submit" className="w-full" disabled={registerMutation.isPending || !canSubmit}>
                  {registerMutation.isPending ? "Sending verification..." : "Create account"}
                </Button>
                <FieldDescription className="pt-0.5 text-center">
                  Already have an account? <a href="/login">Login</a>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-4 text-center text-xs leading-5">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  )
}
