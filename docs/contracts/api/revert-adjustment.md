# API Contract — /api/revert-adjustment

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

The returned plan has the adjustment's `sessions_before` snapshot restored to the relevant week.

## Error responses

| Status | Condition |
|--------|-----------|
| 401 | No valid session |
| 403 | Free tier |
| 404 | Adjustment not found (or belongs to another user) |
| 409 | Adjustment already has status `reverted` |
| 422 | `adjustment_id` missing |

## Notes

- Sets `plan_adjustments.status = 'reverted'` and `reverted_at = now()`.
- Saves updated plan via `savePlanForUser` (archives current plan to `plan_archive` before overwrite).
- Both DB operations run in parallel.
- Works for any adjustment status except `reverted`.

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
