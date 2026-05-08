"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useMutation } from "@tanstack/react-query"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useSearchParams } from "next/navigation"

import { resendVerificationEmail } from "@/lib/auth-client"
import { registrationVerificationGuidance } from "@/lib/auth-email"
import { authToast } from "@/lib/auth-toast"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function VerifyPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const nextPath = searchParams.get("next")
  const email = searchParams.get("email")
  const source = searchParams.get("source")
  const attemptedTokenRef = useRef<string | null>(null)
  const isRegistrationGuidance = !token && source === "register"

  const resendVerificationMutation = useMutation({
    mutationFn: (nextEmail: string) => resendVerificationEmail({ email: nextEmail }),
  })

  const [status, setStatus] = useState<"loading" | "success" | "expired" | "used" | "error" | "guidance">(
    isRegistrationGuidance ? "guidance" : "loading"
  )
  const [message, setMessage] = useState(
    isRegistrationGuidance
      ? registrationVerificationGuidance(email)
      : "Verifying your email..."
  )

  // Cross-tab sync: when the magic link is processed in another tab, that tab
  // posts a BroadcastChannel message. Redirect this stale guidance tab immediately.
  useEffect(() => {
    const channel = new BroadcastChannel("symtext.auth")

    function onMessage(event: MessageEvent<{ type?: string; destination?: string }>) {
      if (event.data?.type !== "verified") return
      const destination = event.data.destination ?? (nextPath && nextPath.startsWith("/") ? nextPath : "/dashboard")
      router.replace(destination)
    }

    channel.addEventListener("message", onMessage)
    return () => {
      channel.removeEventListener("message", onMessage)
      channel.close()
    }
  }, [nextPath, router])

  useEffect(() => {
    async function verify() {
      if (isRegistrationGuidance) {
        setStatus("guidance")
        setMessage(registrationVerificationGuidance(email))
        return
      }

      if (!token) {
        setStatus("error")
        setMessage("Verification token is missing")
        authToast.verifyMissingToken()
        return
      }

      if (attemptedTokenRef.current === token) {
        return
      }

      attemptedTokenRef.current = token

      authToast.verifyLoading()

      try {
        const signInResult = await signIn("email-verify", {
          redirect: false,
          token,
        })

        if (signInResult?.error) {
          if (signInResult.error === "verification_expired") {
            setStatus("expired")
            setMessage("This verification link has expired. Request a new one to continue.")
            authToast.verifyError("Verification link expired")
            return
          }

          if (signInResult.error === "verification_used") {
            setStatus("used")
            setMessage("This verification link was already used. Request a new sign-in link.")
            authToast.verifyError("Verification link already used")
            return
          }

          setStatus("error")
          setMessage("Verification failed. Please request a new link.")
          authToast.verifyError("Verification failed")
          return
        }

        const safeNext = nextPath && nextPath.startsWith("/") ? nextPath : "/dashboard"
        authToast.verifySuccess("Email verified. Signing you in...")
        setStatus("success")
        setMessage("You're signed in! You may close this tab.")

        // Notify the original login tab — it will navigate to the dashboard.
        const channel = new BroadcastChannel("symtext.auth")
        channel.postMessage({ type: "verified", destination: safeNext })
        channel.close()

        // Try to close this tab. Works if it was opened via window.open();
        // email clients typically open new tabs that JS cannot close.
        window.close()

        // Fallback: if the tab is still open after a short delay, redirect normally.
        setTimeout(() => {
          router.push(safeNext)
          router.refresh()
        }, 1800)
      } catch (verifyError) {
        const errorMessage = verifyError instanceof Error ? verifyError.message : "Verification failed"
        setStatus("error")
        setMessage(errorMessage)
        authToast.verifyError(errorMessage)
      }
    }

    void verify()
  }, [email, isRegistrationGuidance, nextPath, router, token])

  async function onResendVerification() {
    if (!email) {
      const noEmailMessage = "Email is missing. Please register again to request a new verification email."
      setStatus("error")
      setMessage(noEmailMessage)
      authToast.resendError(noEmailMessage)
      return
    }

    authToast.resendLoading()

    try {
      const payload = await resendVerificationMutation.mutateAsync(email)
      const successMessage = payload?.message ?? "Verification email sent"
      setStatus("guidance")
      setMessage(registrationVerificationGuidance(email))
      authToast.resendSuccess(successMessage)
    } catch (resendError) {
      const errorMessage = resendError instanceof Error ? resendError.message : "Could not resend verification"
      setStatus("guidance")
      setMessage(errorMessage)
      authToast.resendError(errorMessage)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6 md:p-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Email Verification</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
        {status === "loading" ? (
            <Button type="button" disabled>Verifying...</Button>
          ) : status === "success" ? (
            <Link
              href={nextPath && nextPath.startsWith("/") ? nextPath : "/dashboard"}
              className={buttonVariants()}
            >
              Go to dashboard
            </Link>
          ) : status === "guidance" ? (
            <div className="flex w-full max-w-xs flex-col gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={resendVerificationMutation.isPending}
                onClick={onResendVerification}
              >
                {resendVerificationMutation.isPending ? "Sending verification..." : "Resend verification email"}
              </Button>
              <Link href="/register" className={buttonVariants()}>
                Use another email
              </Link>
            </div>
          ) : (
            <Link href="/login" className={buttonVariants()}>
              Go to login
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-svh bg-background" />}>
      <VerifyPageContent />
    </Suspense>
  )
}
