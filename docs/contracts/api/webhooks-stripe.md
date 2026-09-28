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

`stripeToStatus()` — **`lib/subscriptions/stripeEvents.ts`** since 2026-09-28. It was
previously private to this route, where `vitest` (which collects `lib/**` only) could
never reach it, so the billing path's most consequential decision had no test.

| Stripe status | Written |
|---|---|
| `trialing` | `trialing` |
| `active` | `active` |
| `canceled` | `cancelled` *(note the spelling change — Stripe uses one `l`, the column uses two)* |
| `unpaid`, `incomplete_expired` | `expired` |
| `past_due` | `null` → **no write** (SUBS-CANCELLATION-TIER-01 twin, 2026-09-28) |
| anything else | `null` → **200, no write** |

🔴 **`past_due` USED TO WRITE `expired`, REVOKING A CUSTOMER STRIPE WAS STILL BILLING.**
`past_due` means the invoice failed and **Stripe is retrying**; the customer has paid for
the period they are in. If the retries fail, Stripe moves to `unpaid` or `canceled`, both
of which are handled. This is the same defect as `CANCELLATION` on the RevenueCat side,
and the argument against it was already written in `revenuecatEvents.ts`'s `BILLING_ISSUE`
comment. **It was found by a sweep for the shape of that fix, not by a report.**

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

## Observability (OPS-SUBS-TRACE-01, 2026-09-28)

🔴 **This route had NO durable telemetry of any kind.** Four failure branches and the
success path reported via `console.error` or nothing at all, so **a dropped payment left no
queryable row.** Two of those branches are worse than the RevenueCat route's equivalents: a
subscription carrying no `metadata.user_id` and one carrying no `current_period_end` were
each rejected with a bare console line, and Stripe retries a 400 only briefly.

⚠️ **Instrumenting only the RevenueCat route would have been TWIN-SWEEP-01** — a remedy
applied to one twin reads as finished, so nobody looks at the other. Stripe is the **web**
purchase path and owns the only `subscriptions` row that exists in production.

| Outcome | Ops kind | `detail` |
|---|---|---|
| RPC ran | `stripe_event_received` | `{ provider, event_type, status, applied }` |
| RPC errored (→ 500) | `stripe_event_write_failed` | `{ provider, event_type, status, message }` (truncated to 300 chars) |
| Subscription status did not map | `stripe_event_unhandled` | `{ provider, event_type, stripe_status }` |
| Acted-on event we cannot use (→ 400) | `stripe_event_unusable` | `{ provider, event_type, missing }` — `missing` is `user_id` or `current_period_end` |

- **`_unusable` is deliberately NOT folded into `_unhandled`.** "We have no mapping for this
  event" and "a real payment arrived that we could not apply" are different facts and lead
  to different actions.
- ⚠️ **NOT traced: the non-subscription event types filtered out before this point.** Stripe
  sends many by design and a row per delivery would be noise, which NOISE-GATE-01 records as
  the thing that gets telemetry ignored. Only a *subscription* event worth acting on is
  recorded.
- ⚠️ **`detail.applied === false` is not an error** — it is the ordering guard suppressing a
  stale or replayed delivery, previously only a `console.log`.
- Kind and detail come from **`lib/subscriptions/webhookTrace.ts`**, shared with the
  RevenueCat route so the two cannot drift. Pure and tested (`webhookTrace.test.ts`);
  `app/**` is not collected by vitest.
- **Behavioural only, no PII and no payload** — `ops_events` survives account deletion
  anonymised, so anything here outlives the account.

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
- ✅ **The sibling route now uses this guard too** (`SUBS-ORDERING-REVENUECAT-01`, 2026-09-24).
  `/api/webhooks/revenuecat` performed the plain upsert the migration was written to replace —
  for as long as this one had the guard — even though the migration's own first line names both
  providers. Both routes now call the RPC; RevenueCat resolves `p_event_at` from
  `event_timestamp_ms` via `eventAtIso()`. If you add a **third** provider, wire it here too.
