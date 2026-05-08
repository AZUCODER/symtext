import NextAuth, { CredentialsSignin } from "next-auth"
import Credentials from "next-auth/providers/credentials"

import { API_BASE_URL } from "@/lib/config"
import type { UserRole } from "@/lib/dashboard-types"

const AUTH_SECRET = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET

// ---------------------------------------------------------------------------
// Typed FastAPI verify response
// ---------------------------------------------------------------------------
type FastApiVerifyResponse = {
  access_token: string
  refresh_token: string
  user: {
    name: string
    email: string
    role: UserRole
    is_verified: boolean
  }
}

// ---------------------------------------------------------------------------
// Custom error codes — passed back to client via signIn() result.error
// ---------------------------------------------------------------------------
class InvalidCredentials extends CredentialsSignin {
  code = "verification_failed"
}

class VerificationExpired extends CredentialsSignin {
  code = "verification_expired"
}

class VerificationUsed extends CredentialsSignin {
  code = "verification_used"
}

// ---------------------------------------------------------------------------
// NextAuth v5 configuration
// ---------------------------------------------------------------------------
export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: AUTH_SECRET,
  providers: [
    Credentials({
      id: "email-verify",
      async authorize(credentials) {
        const verificationToken = typeof credentials.token === "string" ? credentials.token : ""
        if (!verificationToken) {
          throw new InvalidCredentials()
        }

        const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: verificationToken,
          }),
          cache: "no-store",
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => null) as { detail?: string } | null
          const detail = typeof payload?.detail === "string" ? payload.detail.toLowerCase() : ""

          if (detail.includes("expired")) {
            throw new VerificationExpired()
          }

          if (detail.includes("already used") || detail.includes("already consumed")) {
            throw new VerificationUsed()
          }

          throw new InvalidCredentials()
        }

        const payload = await response.json() as FastApiVerifyResponse

        return {
          id: payload.user.email,
          name: payload.user.name,
          email: payload.user.email,
          role: payload.user.role,
          accessToken: payload.access_token,
          refreshToken: payload.refresh_token,
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // Initial sign-in — persist tokens and role from the authorize() return value
      if (user) {
        const u = user as typeof user & {
          role: string
          accessToken: string
          refreshToken: string
        }
        token.accessToken = u.accessToken
        token.refreshToken = u.refreshToken
        token.role = u.role
        // Access token lifetime: server ACCESS_TOKEN_EXPIRE_MINUTES (15 min).
        // Refresh 1 minute early to avoid window where token is expired server-side.
        token.expiresAt = Date.now() + 14 * 60 * 1000
        return token
      }

      // Token still valid — return as-is
      if (Date.now() < (token.expiresAt as number)) {
        return token
      }

      // Access token expired — attempt silent refresh
      const refreshed = await tryRefreshToken(token.refreshToken as string | undefined)
      if (refreshed) {
        token.accessToken = refreshed.access_token
        token.refreshToken = refreshed.refresh_token
        token.expiresAt = Date.now() + 14 * 60 * 1000
        delete token.error
        return token
      }

      // Refresh failed — mark session as expired so middleware can redirect
      return { ...token, error: "RefreshTokenExpired" as const }
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken as string
      session.user.role = token.role as "viewer" | "editor" | "admin"
      if (token.error) {
        session.error = token.error as string
      }
      return session
    },
  },

  events: {
    // Revoke refresh token on FastAPI when the user signs out
    async signOut(message) {
      const token = "token" in message ? message.token : null
      const refreshToken = token?.refreshToken as string | undefined
      if (refreshToken) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
          cache: "no-store",
        }).catch(() => null)
      }
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  session: {
    strategy: "jwt",
  },
})

// ---------------------------------------------------------------------------
// Helper — called in jwt callback to silently rotate tokens
// ---------------------------------------------------------------------------
async function tryRefreshToken(
  refreshToken: string | undefined
): Promise<{ access_token: string; refresh_token: string } | null> {
  if (!refreshToken) return null

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  })

  if (!response.ok) return null

  return response.json() as Promise<{ access_token: string; refresh_token: string }>
}
