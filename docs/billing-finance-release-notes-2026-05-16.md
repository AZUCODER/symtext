# Billing and Finance Modules Release Notes

Date: 2026-05-16
Scope: Admin billing configuration, finance visibility, webhook processing hardening, and reconciliation UX.

## Included commits

- `07d9b8a` feat: add admin billing config and finance transaction modules
- `2fc672b` feat: harden billing webhooks and add reconciliation endpoint
- `ed7a978` feat: add finance reconciliation action in dashboard
- `30292a5` feat: add configurable reconcile controls in finance dashboard
- `dd09221` feat: persist finance filters and reconcile params in URL
- `5f0adb1` feat: add copy-share-link action for finance filters
- `66d89a4` chore: revert unintended README change from spec commit

## What shipped

### 1) Billing gateway configuration (admin)
- Added admin billing config APIs for PayPal and Alipay.
- Added encrypted-at-rest storage for app credentials and webhook verification secrets.
- Added masked secret responses and presence flags (`has_*`) to avoid secret leakage.

### 2) Finance transaction visibility (admin)
- Added transaction listing APIs and dashboard table views.
- Payer identity includes both:
  - stable internal customer ID
  - user email
- Added provider references and canonical transaction status display.

### 3) Real webhook processing (PayPal + Alipay)
- Added PayPal webhook signature verification flow.
- Added Alipay signature verification flow.
- Added webhook idempotency via provider event dedupe records.

### 4) Security hardening
- Added replay-window validation for webhook timestamps.
- Added structured billing audit logs for config changes, webhook processing, and reconciliation.

### 5) Reconciliation operations
- Added admin reconciliation endpoint for pending transactions.
- Added finance dashboard action to trigger reconciliation.
- Added configurable reconciliation controls (`older_than_minutes`, `limit`).

### 6) Dashboard UX improvements
- Finance filters and reconciliation parameters persist in URL query params.
- Added one-click "Copy Share Link" for current finance view.

## Verification evidence

- Backend billing API test suite executed and passing.
- Client production build executed and passing after each finance dashboard enhancement.

## Operational notes

- Reconciliation currently updates pending transactions primarily via PayPal status sync path.
- Unsupported provider reconciliation paths are reported as skipped in reconcile results.

## Rollout checklist

- Configure PayPal/Alipay credentials in admin billing settings.
- Verify webhook endpoints are reachable from provider platforms.
- Register webhook IDs/secrets/public keys in provider consoles.
- Run a sandbox payment and confirm transaction appears in finance dashboard.
- Trigger reconciliation from dashboard and confirm updated counts.
