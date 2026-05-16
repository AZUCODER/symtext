# Billing and Finance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add admin billing gateway configuration (PayPal/Alipay) and finance visibility for payer identity and payment details, including real webhook ingestion.

**Architecture:** Reuse existing encrypted app-setting pattern for gateway secrets, add canonical billing tables for customers and transactions, and expose admin-only reporting APIs plus dashboard UI modules.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, httpx, Next.js App Router, TanStack Query, shadcn/ui.

---

### Task 1: Backend Billing Schemas and Persistence

**Files:**
- Modify: `server/app/core/models.py`
- Create: `server/app/schemas/billing.py`

- [ ] Add billing SQLAlchemy models for customers, orders, subscriptions, transactions, and webhook dedupe events.
- [ ] Add billing Pydantic schemas for gateway config, transaction list, and webhook responses.

### Task 2: Backend Billing Service and Routes

**Files:**
- Create: `server/app/services/billing_service.py`
- Create: `server/app/api/routes/billing.py`
- Modify: `server/app/api/router.py`

- [ ] Implement encrypted gateway config persistence and masked config read.
- [ ] Implement admin finance transactions read API with payer email + stable customer ID.
- [ ] Implement PayPal webhook verification via PayPal verification API.
- [ ] Implement Alipay webhook signature verification and event mapping.
- [ ] Add route registration under `/api/v1/billing`.

### Task 3: Backend Tests

**Files:**
- Create: `server/tests/test_billing_api.py`

- [ ] Add admin role-gating tests for billing config and transaction routes.
- [ ] Add secret masking/config update tests.
- [ ] Add webhook idempotency and verification tests.

### Task 4: Client Types, API Proxies, and Helpers

**Files:**
- Modify: `client/src/lib/dashboard-types.ts`
- Create: `client/src/app/api/billing/config/route.ts`
- Create: `client/src/app/api/billing/transactions/route.ts`
- Create: `client/src/lib/billing-client.ts`

- [ ] Add typed billing models.
- [ ] Add Next.js proxy routes for config and transactions.
- [ ] Add typed client helper methods.

### Task 5: Client Dashboard Modules

**Files:**
- Create: `client/src/components/dashboard/billing-configuration.tsx`
- Create: `client/src/components/dashboard/finance-transactions.tsx`
- Create: `client/src/app/(dashboard)/dashboard/billing-configuration/page.tsx`
- Create: `client/src/app/(dashboard)/dashboard/finance-transactions/page.tsx`
- Modify: `client/src/components/dashboard/nav-secondary.tsx`

- [ ] Implement admin-only billing configuration UI.
- [ ] Implement finance transaction list with payer identity and payment detail columns.
- [ ] Add dashboard navigation links.

### Task 6: Verification

**Files:**
- No code changes expected.

- [ ] Run server tests for billing module.
- [ ] Run client build and any affected tests.
- [ ] Confirm route-level access control and payload masking behavior.
