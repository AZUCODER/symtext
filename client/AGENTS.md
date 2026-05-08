# Client — Agent Guidelines

## Stack

| Concern | Library/Version |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 — strict mode |
| UI primitives | shadcn/ui + Tailwind CSS v4 |
| Data fetching | TanStack Query v5 |
| Tables | TanStack Table v8 |
| Forms | react-hook-form v7 + zod v4 |
| Auth | NextAuth v5 (Auth.js) — Credentials provider backed by FastAPI |
| Testing | Vitest v4 + Testing Library + jsdom |

## Project Structure

```
src/
  app/
    (auth)/          # Login, register, verify — unauthenticated routes
    (dashboard)/     # Protected routes — requires symtext_token cookie
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

**Path alias:** `@/*` maps to `src/*`. Always use `@/` imports, never relative `../../`.

## Component Conventions

- **Default to Server Components.** Only add `"use client"` when the component uses browser APIs, event handlers, hooks, or TanStack Query.
- Place page-level data fetching in `page.tsx` (Server Component); pass data down as props or use a `"use client"` child with React Query for interactive/realtime views.
- Co-locate tests next to the component: `login-form.tsx` → `login-form.test.tsx`.

## Styling

- Use Tailwind CSS v4 utility classes. No CSS modules, no inline `style` props.
- Compose class names with `cn()` from `@/lib/utils` (wraps `clsx` + `tailwind-merge`).
- shadcn/ui components and shared UI building blocks live in `src/components/ui/`. Add new shadcn primitives via `npx shadcn add <component>`.

## API Layer

All backend calls go through `apiFetch<T>` in `@/lib/api.ts`:
- Base URL: `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000/api/v1`).
- Always define request/response types in `api.ts` and import them where needed.
- Use `cache: "no-store"` for authenticated or dynamic requests (already the default in `apiFetch`).

## Authentication

Auth is powered by **NextAuth v5 (Auth.js)** with a Credentials provider that delegates to the FastAPI backend.

| File | Role |
|---|---|
| `src/auth.ts` | NextAuth config — Credentials provider, JWT & session callbacks, signOut event |
| `src/app/api/auth/[...nextauth]/route.ts` | NextAuth route handler (handles `/api/auth/signin`, `/api/auth/signout`, `/api/auth/session`, etc.) |
| `src/app/api/auth/register/` | Proxy to FastAPI `/auth/register` — not part of NextAuth |
| `src/app/api/auth/verify-email/` | Proxy to FastAPI `/auth/verify-email` |
| `src/app/api/auth/resend-verification/` | Proxy to FastAPI `/auth/resend-verification` |
| `src/lib/dashboard-auth.ts` | `requireDashboardUser()` — wraps `auth()` for Server Components |

**Session flow:**
1. `LoginForm` calls `signIn("credentials", { redirect: false, email, password })` from `next-auth/react`
2. NextAuth's `authorize` callback calls FastAPI `/auth/login` and returns `{ id, name, email, role, accessToken, refreshToken }`
3. JWT callback stores tokens and `expiresAt` in the encrypted session cookie
4. On subsequent requests, JWT callback auto-refreshes the access token via FastAPI `/auth/refresh` when `expiresAt` is past
5. Middleware calls `auth()` — if no session or `RefreshTokenExpired` error, redirects to `/login`
6. `signOut()` from `next-auth/react` triggers the NextAuth `signOut` event which revokes the FastAPI refresh token

**Required environment variable:**
```
AUTH_SECRET=<random-32-char-string>   # openssl rand -base64 32
```

**Session access in Server Components:**
```ts
import { auth } from "@/auth"
const session = await auth()   // session.accessToken, session.user.role
```

**Do NOT** read the session from cookies directly — always use `auth()` or `requireDashboardUser()`.

## Data Fetching Patterns

| Scenario | Approach |
|---|---|
| Static/SSR data | `async` Server Component with `fetch` / `apiFetch` |
| Mutations & interactive UI | `"use client"` + TanStack Query `useMutation` / `useQuery` |
| Form submission | `react-hook-form` + `zod` schema + `useMutation` on submit |
| Server prefetch + client hydration | Server Component prefetches via `makeQueryClient()`, wraps client child in `<HydrationBoundary>` |

### React Query Setup

- **`QueryProvider`** (`src/components/ui/query-provider.tsx`) — wraps the entire app in `layout.tsx`. Client component using `makeQueryClient()` from `@/lib/react-query`.
- **`makeQueryClient()`** (`src/lib/react-query.ts`) — shared `QueryClient` factory with defaults: `staleTime: 60s`, `gcTime: 5min`, `retry: 1`, `refetchOnWindowFocus: false`.
- **`queryKeys`** (`src/lib/query-keys.ts`) — centralized typed query key registry. Always reference keys from here; never hardcode inline arrays.

```ts
// src/lib/query-keys.ts
export const queryKeys = {
  adminUsers: ["adminUsers"] as const,
  roleAudit: (limit: number) => ["roleAudit", limit] as const,
  agentTask: (taskId: string) => ["agentTask", taskId] as const,
}
```

### Client-Side Fetch Helpers

| File | Purpose |
|---|---|
| `src/lib/dashboard-admin-client.ts` | `getAdminUsers()`, `getRoleAudit(limit)`, `updateUserRole(email, role)` |
| `src/lib/agent-tasks-client.ts` | `createDashboardAgentTask(payload)`, `getDashboardAgentTask(taskId)` |
| `src/lib/auth-client.ts` | Auth mutation helpers + `RegisterFieldError` for field-level API errors |

### Server-Side Hydration Pattern

Use when a page renders data that is known at request time (e.g., admin lists). This avoids a client-side loading flash.

```tsx
// page.tsx (Server Component)
import { makeQueryClient } from "@/lib/react-query"
import { queryKeys } from "@/lib/query-keys"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import { getAdminUsers } from "@/lib/dashboard-admin"  // server-side helper

export default async function MyPage() {
  const queryClient = makeQueryClient()
  await queryClient.prefetchQuery({
    queryKey: queryKeys.adminUsers,
    queryFn: () => getAdminUsers(accessToken),
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <MyClientComponent />
    </HydrationBoundary>
  )
}
```

**When NOT to use server prefetch:** queries whose keys depend on user input at runtime (e.g., `agentTask(taskId)`) cannot be prefetched — the key is unknown at render time. Use `useQuery` with `enabled: false` and trigger manually instead.

### Test Setup for React Query

Any component test that renders a component using `useQuery` or `useMutation` must wrap the render in a `QueryClientProvider`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
)

render(<MyComponent />, { wrapper })
```

## Forms

Use `react-hook-form` with a `zod` resolver. Define the schema in the same file as the form component. Validation errors should display inline using the `field.tsx` primitive from `src/components/ui/`.

## Testing

- Run: `npm test` (Vitest in run mode).
- Test files: `src/**/*.test.ts` or `src/**/*.test.tsx`.
- Test environment: `node` by default; add `@vitest-environment jsdom` docblock for components that need the DOM.
- Mock fetch/API calls with `vi.fn()` — do not hit the real backend in tests.

## Commands

```bash
npm run dev      # Start dev server (Next.js)
npm run build    # Production build
npm run lint     # ESLint
npm test         # Vitest (single run)
```

## Key Rules

1. No `any` — use proper types or `unknown` with narrowing.
2. No `next-auth` custom cookie hacks — use `auth()` and `signIn`/`signOut` from NextAuth.
3. No direct DOM manipulation — use React state/refs.
4. Do not install new UI libraries; extend shadcn/ui or use existing primitives.
5. Route Handlers live in `src/app/api/`; keep business logic in `services/` or `lib/`, not inline in route files.
6. Run `npm run build` after each client UI/UX and Next.js update.

