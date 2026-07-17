# API Contract — /api/maintenance-block

**Method:** POST  
**Auth:** Bearer token required (uses service-role client — safe for native iOS where cookie session is absent). Returns 401 if unauthenticated.  
**Gate:** None — plan structure generation is FREE. AI coaching voice enrichment is PAID (`maintenance_coaching` gate, not yet wired in v1).

## Request body

Empty — no parameters required. All inputs are derived from the authenticated user's plan and `plan.meta`.

```json
{}
```

## Trigger conditions (checked server-side)

The maintenance block generates when all three are true:

1. The plan's last race week is date-complete (`isDatePastWeek(lastRaceWeek, now)` — §73 date-window doctrine, never index compare).
2. `result_embedded` is non-null on that race week (§74 — race result has been logged).
3. No week with `phase === 'maintenance_restoration' | 'maintenance_base'` already exists in the plan.

If condition 3 fails, the route is **idempotent** — returns `{ plan, skipped: true }` with the existing plan unchanged.

## Response — 200 (generated)

```json
{
  "plan": { /* full updated Plan object with maintenance weeks appended */ },
  "weeks_added": 7
}
```

## Response — 200 (skipped — already generated)

```json
{
  "plan": { /* existing Plan object, unchanged */ },
  "skipped": true
}
```

## Error responses

| Status | Condition |
|--------|-----------|
| 400 | No race week found in plan, or race result not yet logged |
| 401 | Missing or invalid Bearer token |
| 404 | No plan found for user |
| 500 | Maintenance block generation or plan save failed (invariant violation or DB error) |

## Side effects

- Calls `savePlanForUser()` which writes to `plans.plan_json` via service-role client.
- `savePlanForUser` archives the pre-maintenance plan in `plan_archive` before writing (standard behaviour).
- Invalidates `plan_weekly_notes` cache (standard `savePlanForUser` side-effect).

## Architecture notes

- Generator lives in `lib/plan/maintenance.ts → generateMaintenanceBlock()`. Pure function, no AI calls.
- Maintenance weeks carry `phase: 'maintenance_restoration'` (Phase 1) or `phase: 'maintenance_base'` (Phase 2).
- Durations are distance-keyed; modifiers for RPE ≥ 8 (+1 week) and DNF (+1 week) stack.
- All coaching numerics live in `GENERATION_CONFIG.POST_RACE_MAINTENANCE_BLOCK`.
- Constitutional invariants enforced by `validateMaintenanceBlock()` in `lib/plan/invariants.ts`.
- See `docs/canonical/CoachingPrinciples.md §75` for the principle behind all maintenance block decisions.

## Client integration

`DashboardClient` calls this route from a `useEffect` that fires when `finishedRace` is non-null and no maintenance weeks exist in the loaded plan. On success, calls `setPlan(data.plan)` to update local state immediately. authedFetch never throws on 4xx/5xx — callers must check `res.ok`.
