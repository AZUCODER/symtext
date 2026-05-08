import { toast } from "sonner"

const IDS = {
  login: "auth-login",
  register: "auth-register",
  resend: "auth-resend",
  verify: "auth-verify",
  logout: "auth-logout",
} as const

export const authToast = {
  loginChallengeLoading() {
    toast.loading("Sending verification link...", { id: IDS.login })
  },
  loginChallengeSent(message: string) {
    toast.success(message, { id: IDS.login })
  },
  loginChallengeError() {
    toast.error("An unexpected error occurred. Please try again.", { id: IDS.login })
  },
  loginVerificationSentInfo() {
    toast.info("Verification email sent. Check your inbox before logging in.", { id: "auth-verify-info" })
  },

  resendLoading() {
    toast.loading("Sending verification email...", { id: IDS.resend })
  },
  resendSuccess(message: string) {
    toast.success(message, { id: IDS.resend })
  },
  resendError(message: string) {
    toast.error(message, { id: IDS.resend })
  },

  registerLoading() {
    toast.loading("Creating your account...", { id: IDS.register })
  },
  registerSuccess(message: string) {
    toast.success(message, { id: IDS.register })
  },
  registerFieldError(message: string) {
    toast.error(message, { id: IDS.register })
  },
  registerError(message: string) {
    toast.error(message, { id: IDS.register })
  },

  verifyMissingToken() {
    toast.error("Verification token is missing")
  },
  verifyLoading() {
    toast.loading("Verifying your email...", { id: IDS.verify })
  },
  verifySuccess(message: string) {
    toast.success(message, { id: IDS.verify })
  },
  verifyError(message: string) {
    toast.error(message, { id: IDS.verify })
  },

  logoutLoading() {
    toast.loading("Signing you out...", { id: IDS.logout })
  },
  logoutError() {
    toast.error("Could not sign out. Please try again.", { id: IDS.logout })
  },
}
