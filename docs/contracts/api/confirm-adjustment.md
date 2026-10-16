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
| 500 | `{ error: 'Could not save the plan' }`. The plan save threw. **The adjustment stays `pending` and the Me flag is untouched**, and `plan_save_failed` is recorded with `route: 'confirm-adjustment'` (ADJUST-STATUS-WITHOUT-SAVE-01) |

## Notes

- **Order (ADJUST-STATUS-WITHOUT-SAVE-01, 2026-10-16): the plan is saved FIRST.** Only after it succeeds are the `plan_adjustments` status and the `user_settings` flag written (those two in parallel). They used to run in one `Promise.all` with the save, so a failed save still flipped the row and the flag, and the change card vanished with nothing to retry.

- Sets `plan_adjustments.status = 'confirmed'` and `confirmed_at = now()`.
- Saves updated plan via `savePlanForUser` (archives previous plan to `plan_archive`).

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

**This route authenticates off the Bearer token, so the save must not use the cookie client**:
on native there is no cookie session, `auth.uid()` is NULL, `plans` RLS refuses the upsert and
`savePlanForUser` throws. Measured 3× on production, all one account, all
`new row violates row-level security policy for table "plans"`.

**It passes the SERVICE client.** ⚠️ This section said `createUserScopedClient(req)` until
2026-10-16; that was the fix's abandoned first cut. `savePlanForUser` calls
`reanchorCharityGrant`, which UPDATEs `charity_codes`, and a user-scoped client may only SELECT
that table, so charity grants would have stopped re-anchoring silently. `adjust-plan` carries
the reasoning; `lib/plan/planRouteClient.test.ts` enforces the choice across every
`savePlanForUser` call in `app/api`.
