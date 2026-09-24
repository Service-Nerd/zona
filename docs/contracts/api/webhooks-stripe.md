# API Contract — /api/webhooks/stripe

**Method:** POST
**Auth:** Stripe webhook signature. No user session — the signature *is* the authentication.
**Gate:** None. Stripe calls this; no client does.
**Route:** `app/api/webhooks/stripe/route.ts`

Together with `/api/webhooks/revenuecat`, this is a **writer of the `subscriptions` table**, which
`resolveTier` reads for every tier decision in the app. A wrong write here mis-tiers a real
paying customer.

## Request

Raw Stripe event body. **Read with `req.text()`, never `req.json()`** — signature verification
needs the exact bytes, and parsing first destroys them.

| Header | Required | Purpose |
|---|---|---|
| `stripe-signature` | yes | Verified by `stripe.webhooks.constructEvent` (timing-safe) against `STRIPE_WEBHOOK_SECRET` |

**Env:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`. Stripe API version is pinned at `2026-03-25.dahlia`.

### Event types acted on

Only these three. Every other event type is acknowledged with `{ received: true }` and **writes
nothing** — that is the designed behaviour, not a gap.

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

### Required fields on the subscription object

| Field | Missing → |
|---|---|
| `metadata.user_id` | **400.** Set at checkout creation time; a subscription without it cannot be attributed |
| `items.data[0].current_period_end` | **400.** Unix seconds; converted to ISO |

## Status mapping

`toStatus()`, local to the route.

| Stripe status | Written |
|---|---|
| `trialing` | `trialing` |
| `active` | `active` |
| `canceled` | `cancelled` *(note the spelling change — Stripe uses one `l`, the column uses two)* |
| `unpaid`, `past_due`, `incomplete_expired` | `expired` |
| anything else | `null` → **200, no write** |

## Response — 200

```json
{ "received": true }
```

Returned for: a successful write, a suppressed stale event, an unhandled event type, and an
unmapped status. **A 200 does not mean a row was written.**

## Error responses

| Status | Condition |
|--------|-----------|
| 401 | Missing `stripe-signature` header, or `STRIPE_WEBHOOK_SECRET` unset, or signature verification failed |
| 400 | Subscription has no `metadata.user_id`, or no `items.data[0].current_period_end` |
| 500 | `apply_subscription_event` returned an error |

## The write — `apply_subscription_event`

**Never a plain upsert.** The route calls the RPC in
`supabase/migrations/20260819_subscription_event_ordering.sql`, which does a conditional upsert
in one statement and returns `TRUE` if applied, `FALSE` if suppressed.

```
apply_subscription_event(p_user_id, p_provider='stripe', p_status, p_period_end, p_event_at)
```

`p_event_at` is `event.created` (the **source** event's timestamp), not `now()`. The write
applies only when `s.last_event_at <= excluded.last_event_at`.

This makes the webhook **idempotent** (a replayed delivery is a no-op) and **order-independent**
(a stale `updated` arriving after a `deleted` is suppressed rather than re-activating a
cancelled subscription). Stripe does not guarantee delivery order.

A suppressed event logs `[stripe webhook] stale/out-of-order event suppressed` and still
returns 200 — Stripe must not be asked to retry an event that was correctly ignored.

## Notes

- Uses the **service-role** client; bypasses RLS. Correct here: there is no user session on a
  webhook, so the cookie client would have no identity and RLS would block the write.
- `provider` is written as `'stripe'`, which is how `resolveTier` distinguishes a Stripe
  subscription from a RevenueCat one or a charity grant.
- ⚠️ **The sibling route does NOT use this guard.** `/api/webhooks/revenuecat` still does the
  plain upsert the migration was written to replace, and the migration's own first line names
  both providers. See that contract's Notes and `SUBS-ORDERING-REVENUECAT-01`.
