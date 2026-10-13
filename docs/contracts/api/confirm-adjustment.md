# API Contract — /api/confirm-adjustment

**Method:** POST  
**Auth:** Bearer token (paid/trial).  
**Gate:** `dynamic_reshape_r20` — returns 403 for free tier.

## Request body

```json
{ "adjustment_id": "uuid" }
```

Required. Returns 422 if missing.

## Response — 200

```json
{ "plan": { /* full updated Plan object */ } }
```

The returned plan has the adjustment's `sessions_after` applied to the relevant week.

## Error responses

| Status | Condition |
|--------|-----------|
| 401 | No valid session |
| 403 | Free tier |
| 404 | Adjustment not found (or belongs to another user) |
| 409 | Adjustment status is not `pending` |
| 422 | `adjustment_id` missing |

## Notes

- Sets `plan_adjustments.status = 'confirmed'` and `confirmed_at = now()`.
- Saves updated plan via `savePlanForUser` (archives previous plan to `plan_archive`).
- Both DB operations run in parallel.

## Data scoping — PLAN-WEEK-COLLISION-01 (2026-09-18)

Reads against `plan_adjustments` filter `superseded_at IS NULL`, so this route
acts on the LIVE plan only. `week_n` is a within-plan coordinate and a new race
plan restarts `week.n` at 1, so an unfiltered lookup would resolve an adjustment
belonging to a plan that no longer exists.

Consequence worth stating: an adjustment created under a PREVIOUS race plan can
no longer be confirmed or reverted. That is intended — the plan it was computed
against has been archived, and applying it would reshape weeks it was never
calculated for.

No request or response shape changes. Enforced by
`lib/plan/supersedeCoverage.test.ts`; the table list is reconciled against the
live schema by `scripts/check-db-drift.ts`.

## Supabase client — ADJUST-PLAN-SAVE-CLIENT-01 (2026-10-13)

**This route authenticates off the Bearer token, so every write must go through a client
that sets `auth.uid()`.** It passes `createUserScopedClient(req)` into `savePlanForUser`.

It previously passed the cookie client (`createClient()` from `@/lib/supabase/server`).
On native there is no cookie session, so `auth.uid()` is NULL, `plans` RLS refuses the
upsert and `savePlanForUser` throws — **after** the caller has already recorded its work.
Measured 3× on production, all one account, all
`new row violates row-level security policy for table "plans"`.

User-scoped rather than service because `plans`, `plan_archive` and `plan_weekly_notes`
all carry `auth.uid() = user_id` policies, so RLS stays live as defence-in-depth.
Enforced by `lib/plan/planRouteClient.test.ts`, whose population is derived from every
`savePlanForUser` call in `app/api`.
