# Billing and Finance Module Design (PayPal + Alipay)

Date: 2026-05-16
Status: Approved design draft for implementation planning

## 1. Goals and Scope

### Primary goals
- Allow admin users to configure payment gateway app IDs and keys for PayPal and Alipay.
- Provide finance visibility for who paid and payment details.
- Support one-time payments and subscriptions.
- Support real webhook processing now (not deferred), with secure verification and idempotency.

### In-scope (MVP+)
- Admin-managed gateway configuration for PayPal and Alipay.
- Canonical billing entities and transaction ledger for one-time and recurring payments.
- Webhook ingestion endpoints for PayPal and Alipay.
- Admin finance reporting APIs and dashboard pages.
- Role-based access control (admin-only for settings and finance data).

### Out of scope for this phase
- End-user checkout UI flows.
- Tax engine and invoice PDF generation.
- Multi-entity accounting exports (ERP connectors).
- Chargeback workflow automation.

## 2. Architecture Overview

### Pattern
- Use a billing core service with provider adapters:
  - `PayPalAdapter`
  - `AlipayAdapter`
- Keep one canonical data model for orders, subscriptions, and transactions.
- Preserve provider-native IDs and statuses for traceability.

### Why this pattern
- Avoids duplicated logic across providers.
- Enables consistent finance reporting and simpler future expansion.
- Aligns with modern payment architecture practices.

## 3. Data Model

## 3.1 `billing_customers`
- `id` (UUID, primary key, stable internal ID)
- `user_email` (string, unique, indexed)
- `created_at`, `updated_at`

Purpose:
- Maintains stable customer identity while preserving email-based linkage.

## 3.2 `payment_gateway_configs`
- `provider` (`paypal` | `alipay`, unique)
- `mode` (`sandbox` | `live`)
- `is_enabled` (boolean)
- `app_id` (encrypted at rest)
- `app_secret_or_private_key` (encrypted at rest)
- `webhook_secret_or_public_key` (encrypted at rest)
- `updated_at`

Notes:
- API never returns raw secrets.
- API returns masked secret previews and boolean presence flags.

## 3.3 `billing_orders`
- `id` (UUID, primary key)
- `customer_id` (FK to `billing_customers.id`)
- `provider` (`paypal` | `alipay`)
- `provider_order_id` (nullable until created upstream)
- `currency` (ISO code)
- `amount_minor` (integer in minor units)
- `status_canonical` (`created` | `pending` | `succeeded` | `failed` | `refunded`)
- `status_provider_raw` (string)
- `idempotency_key` (unique)
- `created_at`, `updated_at`

## 3.4 `billing_subscriptions`
- `id` (UUID, primary key)
- `customer_id` (FK)
- `provider` (`paypal` | `alipay`)
- `provider_subscription_id` (nullable until created upstream)
- `plan_code` (string)
- `currency` (ISO code)
- `amount_minor` (integer)
- `interval_unit` (`day` | `week` | `month` | `year`)
- `interval_count` (integer)
- `status_canonical` (`trialing` | `active` | `past_due` | `canceled` | `expired`)
- `status_provider_raw` (string)
- `current_period_start`, `current_period_end` (datetime nullable)
- `created_at`, `updated_at`

## 3.5 `billing_transactions`
- `id` (UUID, primary key)
- `customer_id` (FK)
- `order_id` (nullable FK)
- `subscription_id` (nullable FK)
- `provider` (`paypal` | `alipay`)
- `provider_transaction_id` (string indexed)
- `transaction_type` (`charge` | `renewal` | `refund` | `adjustment`)
- `currency` (ISO code)
- `amount_minor` (integer)
- `status_canonical` (`pending` | `succeeded` | `failed` | `refunded`)
- `status_provider_raw` (string)
- `occurred_at` (datetime)
- `created_at`

## 3.6 `billing_webhook_events`
- `id` (UUID, primary key)
- `provider` (`paypal` | `alipay`)
- `provider_event_id` (string)
- `event_type` (string)
- `signature_verified` (boolean)
- `payload_sha256` (string)
- `processed` (boolean)
- `processed_at` (datetime nullable)
- `received_at` (datetime)
- Unique constraint: (`provider`, `provider_event_id`)

Purpose:
- Ensures webhook idempotency and auditability.

## 3.7 `billing_audit_logs`
- `id` (UUID, primary key)
- `actor_email` (string)
- `action` (string)
- `entity_type` (string)
- `entity_id` (string)
- `metadata_json` (text, no secrets)
- `created_at`

## 4. Security and Compliance Controls

- Enforce admin role for configuration and finance endpoints.
- Encrypt all gateway secrets at rest.
- Never expose full secrets in responses or logs.
- Verify webhook signatures and reject invalid or stale callbacks.
- Require idempotent processing for all webhook events.
- Store raw payload hash and provider event ID for forensic tracing.

## 5. API Design

## 5.1 Admin gateway configuration
- `GET /api/v1/billing/gateways/config`
- `PUT /api/v1/billing/gateways/config`

Response shape highlights:
- provider status (`configured`, `enabled`, `mode`)
- masked keys (`****abcd`)
- `has_app_id`, `has_secret`, `has_webhook_secret`

## 5.2 Finance reporting
- `GET /api/v1/billing/summary`
- `GET /api/v1/billing/transactions?provider=&status=&from=&to=&customer=`
- `GET /api/v1/billing/customers/{customer_id}/payments`

Returned payer identity fields:
- `customer_id` (stable internal ID)
- `user_email`

## 5.3 Billing operations (internal/service)
- `POST /api/v1/billing/orders`
- `POST /api/v1/billing/subscriptions`

Operational rules:
- Require idempotency key.
- Persist local entity before and after upstream call transitions.

## 5.4 Webhook endpoints
- `POST /api/v1/billing/webhooks/paypal`
- `POST /api/v1/billing/webhooks/alipay`

Webhook flow:
1. Verify signature and timestamp window.
2. Parse event ID and event type.
3. Insert dedupe record in `billing_webhook_events`.
4. If duplicate event, return success without reapplying mutations.
5. Map provider event to canonical status changes.
6. Update order/subscription and append transaction records.
7. Mark webhook event processed.

## 6. Status Mapping

## 6.1 One-time payment canonical states
- `created`
- `pending`
- `succeeded`
- `failed`
- `refunded`

## 6.2 Subscription canonical states
- `trialing`
- `active`
- `past_due`
- `canceled`
- `expired`

Mapping policy:
- Keep canonical status for business logic.
- Keep provider raw status for diagnostics and reconciliation.

## 7. Client Dashboard Design

## 7.1 New admin pages
- `/dashboard/billing-configuration`
- `/dashboard/finance-transactions`
- `/dashboard/subscription-monitor`

## 7.2 UI capabilities
- Billing configuration page:
  - provider select (PayPal/Alipay)
  - mode toggle (sandbox/live)
  - credential fields with masked placeholders
  - enabled/disabled controls
- Finance transactions page:
  - table with filters (date, provider, status, customer)
  - columns: customer ID, email, amount, currency, type, status, provider references, timestamp
- Subscription monitor page:
  - active/past_due/canceled status view
  - period boundaries and next billing context

## 7.3 Access control
- Only admin can access and mutate these pages.
- Non-admin users receive forbidden behavior consistent with existing dashboard patterns.

## 8. Reliability and Operations

- Idempotency keys for outbound create operations.
- Webhook dedupe and replay-safe handling.
- Reconciliation job (scheduled) to compare local status to provider status.
- Structured logging dimensions:
  - `provider`
  - `provider_event_id`
  - `customer_id`
  - `order_id` or `subscription_id`

## 9. Testing Strategy

Backend tests:
- API role-gating tests for admin and non-admin paths.
- Gateway config tests ensuring masked secret responses and encrypted persistence.
- Webhook verification tests:
  - valid signature accepted
  - invalid signature rejected
  - duplicate event id is idempotent
  - out-of-order events handled safely
- Status mapping unit tests for PayPal and Alipay adapters.

Client tests:
- Admin-only access behavior for billing/finance pages.
- Configuration form mutation tests.
- Transactions table rendering/filter tests with typed API fixtures.

## 10. Implementation Notes for This Repository

- Reuse existing encrypted app setting approach used by media/cloud config modules.
- Follow current role-checking and route dependency patterns.
- Follow current Next.js proxy route plus typed client helper pattern.
- Keep initial implementation provider-ready with mockable adapter boundaries where provider SDK-specific code is added.

## 11. Success Criteria

- Admin can securely configure PayPal and Alipay credentials without exposing secrets.
- Finance module shows who paid using both `customer_id` and `user_email`.
- One-time and subscription events from webhooks update canonical records correctly and idempotently.
- Admin can query payment and subscription details from dashboard pages and APIs.
