# Passwordless Auth Migration Notes

## Summary

Authentication was refactored from email+password to email-only passwordless verification.

## Removed

- Password in register/login payloads.
- Password reset endpoints and frontend pages/forms.
- Password-focused frontend validation and error messaging.

## Added

- One-time email challenge persistence in backend `email_challenges` table.
- Email-only login initiation endpoint behavior that is non-enumerating.
- Verification endpoint behavior that consumes one-time challenge and issues auth tokens.
- Frontend login flow that sends a challenge and completes sign-in only after verification.

## Backend Contract Changes

- `POST /api/v1/auth/register`
  - Request: `{ email }`
  - Response: verification message
- `POST /api/v1/auth/login`
  - Request: `{ email, next? }`
  - Response: generic non-enumerating message
- `POST /api/v1/auth/verify-email`
  - Request: `{ token }`
  - Response: `{ access_token, refresh_token, token_type, user }`
- `POST /api/v1/auth/resend-verification`
  - Request: `{ email }`
  - Response: generic non-enumerating message

## Behavior Notes

- Login and resend do not reveal whether an account exists.
- Verification tokens are single-use and expire.
- Refresh and logout behavior is unchanged.
- Protected routes still require a verified and authenticated session.

## Data Model Notes

- `users.password` is no longer used by application logic.
- `email_challenges` was added for one-time challenge lifecycle.

## Frontend Flow

1. User enters email in login/register.
2. App requests challenge email.
3. User opens verification link.
4. Verify page exchanges token via NextAuth credentials provider.
5. Session is established and user is redirected to dashboard or provided `next` path.
