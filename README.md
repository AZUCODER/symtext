# Symtext

Fullstack CMS and agent-task platform using Next.js 16 (App Router) and FastAPI.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript 5, Tailwind CSS v4, shadcn/ui, TanStack Query v5 |
| Backend | FastAPI, Pydantic v2, JWT (HS256), SQLAlchemy, slowapi |
| Auth | NextAuth v5 (Credentials) + FastAPI access/refresh token endpoints |
| Email | Resend |
| Testing | Vitest + Testing Library (client) |

## Repository

```text
client/   Next.js application
server/   FastAPI application
docs/     Architecture and project notes
```

## Quick start

1. Start backend:

```powershell
cd server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

2. Start frontend (new terminal):

```powershell
cd client
copy .env.example .env.local
npm install
npm run dev
```

## Required environment values

Server `.env`:
- `JWT_SECRET_KEY`
- `ACCESS_TOKEN_EXPIRE_MINUTES` (default: 15)
- `REFRESH_TOKEN_EXPIRE_DAYS` (default: 30)
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `APP_BASE_URL`
- `FRONTEND_ORIGINS`

Client `.env.local`:
- `AUTH_SECRET`
- `NEXT_PUBLIC_API_URL` (default: `http://localhost:8000/api/v1`)

## Local URLs

- Frontend: http://localhost:3000
- Backend Swagger: http://localhost:8000/docs
- Backend ReDoc: http://localhost:8000/redoc
- Health: http://localhost:8000/api/v1/health

## API surface (summary)

Public auth endpoints:
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/verify-email`
- `POST /api/v1/auth/resend-verification`

Protected endpoints:
- `GET /api/v1/auth/me` (authenticated)
- `GET /api/v1/auth/users` (admin)
- `PATCH /api/v1/auth/users/role` (admin)
- `GET /api/v1/auth/users/role-audit` (admin)
- `POST /api/v1/agent/tasks` (editor or admin)
- `GET /api/v1/agent/tasks/{task_id}` (editor or admin)

## Current behavior and limitations

- Authentication is passwordless and email-only.
- New registrations are guided to `/verify` to check email (instead of redirecting to login).
- Verification page supports resending verification email for registration guidance state.
- Auth routes include rate limiting on sensitive endpoints.
- Security headers are applied by backend middleware.
- Users and refresh-token state are persisted in PostgreSQL.
- Role-audit events and agent tasks are still in-memory (MVP).

## Related docs

- [server/README.md](server/README.md): backend operations and endpoint details.
- [client/README.md](client/README.md): frontend architecture and scripts.
