# Workspace Agent Rules

## Python Environment (Canonical)

- The only Python virtual environment for this repository is `server/.venv`.
- For any Python task (tests, scripts, linting, app run, package install), use the `server` folder as the Python workspace root.
- Do not create, use, or search for Python environments outside `server/` (for example, repo root `.venv` or `client/.venv`).

## Operational Guardrail

- If Python tooling cannot find an environment, resolve it from `server/.venv` first.
- Keep all Python dependency operations scoped to `server/requirements.txt` and the `server` working directory.

## Client - Agent Guidelines

### Stack

| Concern | Library/Version |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 - strict mode |
| UI primitives | shadcn/ui + Tailwind CSS v4 |
| Data fetching | TanStack Query v5 |
| Tables | TanStack Table v8 |
| Forms | react-hook-form v7 + zod v4 |
| Auth | NextAuth v5 (Auth.js) - Credentials provider backed by FastAPI |
| Testing | Vitest v4 + Testing Library + jsdom |

### Project Structure

```text
client/src/
	app/
		(auth)/          # Login, register, verify - unauthenticated routes
		(dashboard)/     # Protected routes - requires symtext_token cookie
		(homepage)/      # Public landing page
		api/             # Next.js Route Handlers
			_lib/auth.ts   # Server-side auth helpers (cookie read/write, token refresh)
	components/
		auth/            # Authentication forms and related tests
		dashboard/       # Dashboard shell, nav, tables, charts, and feature panels
		ui/              # shadcn/ui primitives and shared UI components
	hooks/             # Custom React hooks
	lib/
		api.ts           # Typed API client (apiFetch) + shared payload/response types
		dashboard-auth.ts
		utils.ts         # cn() and other utilities
```

Path alias: `@/*` maps to `client/src/*`. Always use `@/` imports, never relative `../../`.

### Component Conventions

- Default to Server Components. Only add `"use client"` when the component uses browser APIs, event handlers, hooks, or TanStack Query.
- Place page-level data fetching in `page.tsx` (Server Component); pass data down as props or use a `"use client"` child with React Query for interactive/realtime views.
- Co-locate tests next to the component: `login-form.tsx` -> `login-form.test.tsx`.

### Styling

- Use Tailwind CSS v4 utility classes. No CSS modules, no inline `style` props.
- Compose class names with `cn()` from `@/lib/utils` (wraps `clsx` + `tailwind-merge`).
- shadcn/ui components and shared UI building blocks live in `client/src/components/ui/`. Add new shadcn primitives via `npx shadcn add <component>`.

### API Layer

All backend calls go through `apiFetch<T>` in `@/lib/api.ts`:
- Base URL: `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000/api/v1`).
- Always define request/response types in `api.ts` and import them where needed.
- Use `cache: "no-store"` for authenticated or dynamic requests (already the default in `apiFetch`).

### Authentication

Auth is powered by NextAuth v5 (Auth.js) with a Credentials provider that delegates to the FastAPI backend.

| File | Role |
|---|---|
| `client/src/auth.ts` | NextAuth config - Credentials provider, JWT & session callbacks, signOut event |
| `client/src/app/api/auth/[...nextauth]/route.ts` | NextAuth route handler (handles `/api/auth/signin`, `/api/auth/signout`, `/api/auth/session`, etc.) |
| `client/src/app/api/auth/register/` | Proxy to FastAPI `/auth/register` - not part of NextAuth |
| `client/src/app/api/auth/verify-email/` | Proxy to FastAPI `/auth/verify-email` |
| `client/src/app/api/auth/resend-verification/` | Proxy to FastAPI `/auth/resend-verification` |
| `client/src/lib/dashboard-auth.ts` | `requireDashboardUser()` - wraps `auth()` for Server Components |

Session flow:
1. `LoginForm` calls `signIn("credentials", { redirect: false, email, password })` from `next-auth/react`
2. NextAuth's `authorize` callback calls FastAPI `/auth/login` and returns `{ id, name, email, role, accessToken, refreshToken }`
3. JWT callback stores tokens and `expiresAt` in the encrypted session cookie
4. On subsequent requests, JWT callback auto-refreshes the access token via FastAPI `/auth/refresh` when `expiresAt` is past
5. Middleware calls `auth()` - if no session or `RefreshTokenExpired` error, redirects to `/login`
6. `signOut()` from `next-auth/react` triggers the NextAuth `signOut` event which revokes the FastAPI refresh token

Required environment variable:
```text
AUTH_SECRET=<random-32-char-string>
```

Session access in Server Components:
```ts
import { auth } from "@/auth"
const session = await auth()
```

Do NOT read the session from cookies directly - always use `auth()` or `requireDashboardUser()`.

### Data Fetching Patterns

| Scenario | Approach |
|---|---|
| Static/SSR data | `async` Server Component with `fetch` / `apiFetch` |
| Mutations & interactive UI | `"use client"` + TanStack Query `useMutation` / `useQuery` |
| Form submission | `react-hook-form` + `zod` schema + `useMutation` on submit |
| Server prefetch + client hydration | Server Component prefetches via `makeQueryClient()`, wraps client child in `<HydrationBoundary>` |

React Query setup:
- `QueryProvider` (`client/src/components/ui/query-provider.tsx`) wraps the app in `layout.tsx`.
- `makeQueryClient()` (`client/src/lib/react-query.ts`) defaults: `staleTime: 60s`, `gcTime: 5min`, `retry: 1`, `refetchOnWindowFocus: false`.
- `queryKeys` (`client/src/lib/query-keys.ts`) is the single source of query keys.

### Forms

Use `react-hook-form` with a `zod` resolver. Define the schema in the same file as the form component. Validation errors should display inline using the `field.tsx` primitive from `client/src/components/ui/`.

### Testing

- Run: `npm test` (Vitest in run mode).
- Test files: `src/**/*.test.ts` or `src/**/*.test.tsx`.
- Test environment: `node` by default; add `@vitest-environment jsdom` for components that need the DOM.
- Mock fetch/API calls with `vi.fn()`; do not hit the real backend in tests.

### Commands

```bash
cd client
npm run dev
npm run build
npm run lint
npm test
```

### Key Rules

1. No `any` - use proper types or `unknown` with narrowing.
2. No `next-auth` custom cookie hacks - use `auth()` and `signIn`/`signOut` from NextAuth.
3. No direct DOM manipulation - use React state/refs.
4. Do not install new UI libraries; extend shadcn/ui or use existing primitives.
5. Route Handlers live in `client/src/app/api/`; keep business logic in `services/` or `lib/`, not inline in route files.
6. Run `npm run build` after each client UI/UX and Next.js update.