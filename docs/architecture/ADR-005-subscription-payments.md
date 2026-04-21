# ADR-005 — Subscription Payment Architecture

**Status**: Accepted  
**Date**: 2026-04-21

---

## Context

Zona requires a subscription payment system before App Store submission. Two surfaces need handling:

- **iOS (App Store)**: Apple §3.1.1 mandates all in-app digital purchases route through StoreKit. Direct Stripe calls from a WKWebView-wrapped app are not permitted.
- **Web (direct)**: Users who sign up via the web (or browser on iOS) can pay through Stripe without Apple involvement.

---

## Decision

### iOS — RevenueCat + StoreKit 2

- The iOS native wrapper implements StoreKit 2 via the RevenueCat SDK
- RevenueCat abstracts receipt validation, trial management, and subscription lifecycle
- RevenueCat fires webhooks to `POST /api/webhooks/revenuecat` on subscription state changes
- The webhook handler upserts into the `subscriptions` Supabase table
- **No StoreKit or RevenueCat code lives in this Next.js repo** — it belongs in the iOS wrapper repo

### Web — Stripe

- Stripe Checkout handles web subscription payments
- Stripe fires webhooks to `POST /api/webhooks/stripe` on subscription state changes
- The webhook handler upserts into the same `subscriptions` Supabase table

### Supabase — Single Source of Truth

All subscription gating reads from the `subscriptions` table only. Neither StoreKit state nor Stripe API calls are used directly in the Next.js app.

A user is considered active if:
```
status IN ('trialing', 'active') AND current_period_end > now()
```

### Small Business Program

Enrol in Apple's Small Business Program before the first live transaction to qualify for 15% (not 30%) commission rate.

---

## Schema

```sql
CREATE TABLE subscriptions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider           TEXT NOT NULL CHECK (provider IN ('revenuecat', 'stripe')),
  status             TEXT NOT NULL CHECK (status IN ('trialing', 'active', 'cancelled', 'expired')),
  current_period_end TIMESTAMPTZ NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX subscriptions_user_id_idx ON subscriptions(user_id);
```

One row per user — upserted on every webhook event.

---

## Webhook Routes

| Route | Provider | Secret env var |
|-------|----------|---------------|
| `POST /api/webhooks/revenuecat` | RevenueCat | `REVENUECAT_WEBHOOK_SECRET` |
| `POST /api/webhooks/stripe` | Stripe | `STRIPE_WEBHOOK_SECRET` |

Both routes verify the inbound signature before touching the database.

---

## Out of Scope for v1

- External Purchase Entitlement (Apple DMA route) — v2 consideration
- Google Play Billing / Android — v2 consideration
- Direct Stripe API calls from any client component — permanently banned

---

## Consequences

- **Positive**: Single Supabase table is the only subscription state the app reads. No provider-specific logic leaks into feature gates.
- **Positive**: RevenueCat handles StoreKit 2 complexity, receipt validation, and sandbox/production switching.
- **Positive**: Web path (Stripe) and iOS path (RevenueCat) converge to the same data model.
- **Constraint**: Webhook signature verification is mandatory on both routes — unsigned requests must return 401 and never touch the DB.
- **Constraint**: Both webhook handlers must be idempotent — RevenueCat and Stripe both retry on non-2xx.
- **Dependency**: iOS StoreKit 2 implementation lives in the native wrapper repo, not here.
