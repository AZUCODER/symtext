const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function validateEmail(
  value: string,
  requiredMessage = "Please enter your email address"
): string | null {
  const normalized = value.trim()

  if (!normalized) {
    return requiredMessage
  }

  if (!EMAIL_PATTERN.test(normalized)) {
    return "Please enter a valid email address"
  }

  return null
}

export function registrationVerificationGuidance(email?: string | null): string {
  return `Check ${email ?? "your email"} for your verification link to complete registration.`
}
