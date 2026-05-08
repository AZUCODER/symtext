// This file augments NextAuth v5 session/JWT types.
// The top-level `export {}` is required to make TypeScript treat this as a
// module file (augmentation) rather than a global script (replacement).
export {}

type UserRole = "viewer" | "editor" | "admin"

declare module "next-auth" {
  interface Session {
    /** FastAPI access token — passed as Bearer to the backend */
    accessToken: string
    /** Set to "RefreshTokenExpired" when silent refresh fails */
    error?: string
    user: {
      name?: string | null
      email?: string | null
      image?: string | null
      role: UserRole
    }
  }

  interface User {
    role: string
    accessToken: string
    refreshToken: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string
    refreshToken?: string
    role?: string
    /** Unix ms timestamp — when to attempt refresh */
    expiresAt?: number
    error?: string
  }
}
