# API Contract — /api/recalibrate-taper

**Method:** POST
**Auth:** Bearer token.
**Gate:** `dynamic_reshape_r20` — PAID/trial. A free caller is **skipped, not refused**
(200 with `reason: 'subscription_required'`), because this route fires automatically at
taper entry rather than on a tap: a 403 would surface as an error the runner did not cause.

Written 2026-10-13 under `ADJUST-PLAN-SAVE-CLIENT-01`, which removed a dead cookie client
from this route and found it had no contract at all. Reduces `CONTRACT-COVERAGE-01` by one.

## Request body

None. Everything is derived from the user's live plan and `strava_activities`.

## Response — 200, recalibrated

```json
{ "recalibrated": true, "plan": { /* full Plan */ } }
```

## Response — 200, skipped

```json
{ "skipped": true, "reason": "no_plan" }
```

`reason` is one of `subscription_required` · `no_plan` · `no_taper_phase` ·
`actuals_query_failed` · any `result.skipReason` from `recalibrateTaper`.

⚠️ **Every skip is a 200.** The route is idempotent and fires once per plan (guarded by
`plan.meta.taper_recalibrated_at`), so "nothing to do" is the common case, not a failure.

## Response — 401

```json
{ "error": "Unauthorized" }
```

## Preconditions the route checks, in order

1. Paid or trial · 2. a live plan exists · 3. the current week is the **first** week of the
taper phase · 4. `meta.taper_recalibrated_at` is absent · 5. at least
`TAPER_RECAL_MIN_WEEKS_DATA` actual weeks on record for build/peak weeks · 6. the actual
functional peak is below `TAPER_RECAL_VOLUME_THRESHOLD_PCT` of the planned peak.

## Supabase client

Service client throughout, including the `savePlanForUser` write — it authenticates off
the Bearer token, so a cookie client's `auth.uid()` would be NULL on native and `plans`
RLS would refuse the upsert (`ADJUST-PLAN-SAVE-CLIENT-01`). Enforced by
`lib/plan/planRouteClient.test.ts`.

## Doctrine

CoachingPrinciples §68. ADR-006 — this is the deterministic step only; no AI call.


## Plan read — PLANS-SINGLE-NOT-MAYBE-01 (2026-10-16)

The `plans` row is read through `readPlanJson` (`lib/planRead.ts`), the one owner of that query. It uses
`.maybeSingle()`, so a runner with **no plan is `null` with no error**, not the PostgREST 406 that made up 89
of 94 Supabase warnings in a day. **A database error now answers `500 { error: 'Could not load your plan' }`.** It used to be indistinguishable from "no plan" and answered as if the runner had none.
