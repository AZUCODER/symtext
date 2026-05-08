# Symtext FastAPI Server

Backend API for the Symtext Next.js + FastAPI app.

## Quick start

```powershell
cd server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Environment

Set in `.env`:
- `JWT_SECRET_KEY`: long random secret (required outside development)
- `ACCESS_TOKEN_EXPIRE_MINUTES`: access token TTL (default: 15)
- `REFRESH_TOKEN_EXPIRE_DAYS`: refresh token TTL (default: 30)
- `RESEND_API_KEY` and `RESEND_FROM_EMAIL`: email delivery
- `APP_BASE_URL`: frontend base URL used in email links
- `FRONTEND_ORIGINS`: comma-separated allowed CORS origins

## Local URLs

- API root: http://localhost:8000/
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- Health: http://localhost:8000/api/v1/health

## Auth and security behavior

- Authentication is passwordless and email-only.
- Login and registration both send one-time verification challenges.
- Verification links are one-time use and expire.
- Access and refresh tokens are JWT-based.
- Refresh token rotation is enforced (latest token hash per user).
- Email verification is required before protected access.
- Startup initialization removes legacy `users.password` column when present on PostgreSQL.
- RBAC is enforced server-side (`viewer`, `editor`, `admin`).
- Security headers are added by middleware.
- Rate limits are applied to sensitive auth routes.

Current auth route limits:
- `POST /api/v1/auth/register`: 5/minute
- `POST /api/v1/auth/login`: 10/minute
- `POST /api/v1/auth/resend-verification`: 5/minute

## API endpoints

Public:
- `GET /`
- `GET /api/v1/health`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/verify-email`
- `POST /api/v1/auth/resend-verification`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`

Authenticated:
- `GET /api/v1/auth/me`

Admin only:
- `GET /api/v1/auth/users`
- `PATCH /api/v1/auth/users/role`
- `GET /api/v1/auth/users/role-audit`

Editor or admin:
- `POST /api/v1/agent/tasks`
- `GET /api/v1/agent/tasks/{task_id}`

## Frontend integration

In client `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

## Project layout

- `app/main.py`: app setup, CORS, security headers, limiter
- `app/api/router.py`: API v1 router
- `app/api/routes/auth.py`: auth and role management endpoints
- `app/api/routes/cms.py`: agent task endpoints
- `app/api/deps.py`: auth dependencies and role guards
- `app/core/security.py`: password hashing and JWT helpers
- `app/core/database.py`: SQLAlchemy engine/session and table initialization
- `app/core/models.py`: database models for users, refresh tokens, and email challenges
- `app/core/limiter.py`: shared rate limiter

## MVP limitations

- Users and refresh-token state are persisted in PostgreSQL.
- Role-audit events and agent tasks are still in-memory.
- For production, add persistent audit/task storage and queue infrastructure.

## Related docs

- [README.md](../README.md): project overview and fullstack quick start.
- [client/README.md](../client/README.md): frontend routes and auth integration.
