# Symtext Client

Next.js 16 App Router frontend for Symtext.

## Quick start

```powershell
cd client
copy .env.example .env.local
npm install
npm run dev
```

Runs at http://localhost:3000.

## Local URLs

- Frontend: http://localhost:3000
- Backend API docs: http://localhost:8000/docs
- Backend health: http://localhost:8000/api/v1/health

## Environment

- `AUTH_SECRET`: required by NextAuth.
- `NEXT_PUBLIC_API_URL`: FastAPI base URL (default: `http://localhost:8000/api/v1`).

## Scripts

- `npm run dev`: start development server
- `npm run build`: production build
- `npm run start`: run production build
- `npm run lint`: run ESLint
- `npm run test`: run Vitest tests

## Application routes

Public:
- `/`
- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`
- `/verify`

Protected:
- `/dashboard`
- `/dashboard/agent-tools`
- `/dashboard/system-status`

## Architecture summary

- `src/auth.ts`: NextAuth credentials flow backed by FastAPI login/refresh/logout endpoints.
- `middleware.ts`: guards dashboard routes and redirects expired sessions.
- `src/app/api/**`: route handlers used as server-side API boundary/proxy to FastAPI.
- `src/lib/react-query.ts`: shared TanStack Query client defaults.
- `src/lib/dashboard-auth.ts`: server-side dashboard session guard.

## Data and auth flow

- Browser calls Next.js route handlers (for auth/admin/agent actions).
- Route handlers call FastAPI with server-side credentials/tokens.
- NextAuth session stores access/refresh token state and performs silent refresh before expiry.
- Registration is verification-first: successful sign-up routes users to `/verify?source=register&email=...`.
- `/verify` handles both token verification and registration guidance mode (check inbox + resend verification).

## Security and session behavior

- Dashboard routes are protected by middleware and server-side session checks.
- Authentication uses passwordless NextAuth credentials with FastAPI token endpoints.
- Access token refresh is handled automatically before token expiration.

## Testing

Run all tests:

```powershell
npm run test
```

Run a single test file:

```powershell
npm run test -- src/components/auth/login-form.test.tsx
```

## Related docs

- [README.md](../README.md): project overview and fullstack setup.
- [server/README.md](../server/README.md): backend auth, security, and API details.
