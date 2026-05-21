# Symtext FastAPI Server

Backend API for the Symtext Next.js + FastAPI app.

## Quick start

Python venv location policy: use `server/.venv` only.

```powershell
cd server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Redis + Celery (local)

PR2 queue infrastructure uses Redis as broker/result backend and Celery workers.

Environment variables (already in `.env.example`):
- `CELERY_BROKER_URL` (default: `redis://127.0.0.1:6379/0`)
- `CELERY_RESULT_BACKEND` (default: `redis://127.0.0.1:6379/1`)
- `CELERY_TASK_DEFAULT_QUEUE` (default: `symtext-agent-tasks`)

Start worker (PowerShell):

```powershell
cd server
.\.venv\Scripts\Activate.ps1
celery -A app.worker.celery_app worker --loglevel=info
```

Start worker (WSL):

```bash
cd /mnt/d/webapp/symtext.com/server
source .venv/bin/activate
celery -A app.worker.celery_app worker --loglevel=info
```

If Redis is running in WSL, run the API and Celery worker in WSL as well for the simplest setup.

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
- `OSS_ENDPOINT`, `OSS_BUCKET_NAME`, `OSS_ACCESS_KEY_ID`, `OSS_ACCESS_KEY_SECRET`: Alibaba Cloud OSS credentials and region endpoint
- `OSS_PUBLIC_BASE_URL`: optional CDN/custom domain for media URLs
- `OSS_UPLOAD_DIR`, `OSS_SIGNED_URL_EXPIRES_SECONDS`, `OSS_MAX_UPLOAD_BYTES`: upload policy defaults

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
- `POST /api/v1/blog`
- `PATCH /api/v1/blog/{id}`
- `POST /api/v1/blog/{id}/publish`
- `POST /api/v1/blog/{id}/archive`
- `DELETE /api/v1/blog/{id}` (soft delete)
- `POST /api/v1/media/oss/sign-upload`

Admin only:
- `GET /api/v1/media/oss/config`
- `PUT /api/v1/media/oss/config`

Public (published + public posts only):
- `GET /api/v1/blog`
- `GET /api/v1/blog/{id}`
- `GET /api/v1/blog/slug/{slug}`

Editor/admin (can also access drafts and use filters):
- `GET /api/v1/blog` (with `status`, `author_email`, `locale`, `visibility`, `include_deleted` query params)

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
- `app/core/models.py`: database models — users, refresh tokens, email challenges, **blog posts**
- `app/core/limiter.py`: shared rate limiter

## Blog CRUD — design notes

### Field design rationale
- `slug` — URL-safe unique identifier; immutable post-publish for non-admins (SEO stability)
- `content_markdown` + `content_json` — dual representation: human-authored Markdown + optional rich structured payload for AI/agent workflows
- `status` workflow: `draft → review → scheduled/published/archived`
- `visibility` — `public` (anonymous read), `unlisted` (direct link only), `private` (auth only)
- `ai_summary`, `ai_keywords_json` — agent-writable fields for CMS enrichment pipeline
- `version` (integer) — optimistic concurrency; incremented on every mutation
- `deleted_at` — soft delete; rows are never removed
- `seo_title`, `seo_description`, `canonical_url` — first-class SEO fields, not an afterthought

### Status workflow and role permissions
| Action | viewer | editor | admin |
|--------|--------|--------|-------|
| Create | ✗ | ✓ | ✓ |
| Read public posts | ✓ | ✓ | ✓ |
| Read drafts/private | ✗ | ✓ | ✓ |
| Update | ✗ | ✓ (guarded transitions) | ✓ (all) |
| Publish/Schedule | ✗ | ✓ | ✓ |
| Archive | ✗ | ✓ | ✓ |
| Soft delete | ✗ | ✓ | ✓ |
| Change slug after publish | ✗ | ✗ | ✓ |
| Reactivate archived | ✗ | ✗ | ✓ |

## MVP limitations

- Users and refresh-token state are persisted in PostgreSQL.
- Role-audit events and agent tasks are still in-memory.
- Redis + Celery local worker infrastructure is now available and runnable for PR2 development.
- Agent task endpoints are not yet wired to durable DB-backed queued execution.
- For production, add persistent audit/task storage and complete queue orchestration.

## Alibaba Cloud OSS upload flow

- Frontend requests `POST /api/v1/media/oss/sign-upload` with `filename`, `content_type`, and `media_type`.
- Backend uses the official `oss2` SDK to generate a time-limited signed PUT URL.
- Frontend uploads directly to OSS with the returned headers and then stores `public_url` in the post field.

Cloud OSS provider selection:
- Admin can select `aliyunoss`, `huaweioss`, or `awsoss` through config endpoints.
- Current signed-upload implementation supports `aliyunoss` only in this MVP.
- Non-Aliyun providers are configurable now and can be wired for signed uploads next.

Important: configure CORS rules on the OSS bucket to allow browser `PUT` uploads from your frontend domains.

## Related docs

- [README.md](../README.md): project overview and fullstack quick start.
- [client/README.md](../client/README.md): frontend routes and auth integration.
