# API Contract — /api/recalibrate-zones

**Method:** POST  
**Auth:** Bearer token (paid/trial).  
**Gate:** `dynamic_reshape_r20` — returns 403 for free tier.

## Request body

```json
{
  "benchmark": {
    "type": "race",
    "distance_km": 10,
    "time": "00:48:30"
  }
}
```

`benchmark` fields all required (`type`, `distance_km`, `time`). Returns 422 if any are missing.

`type` values: `"race"` | `"time_trial"`

## Response — 200

```json
{
  "plan": { /* full updated Plan object with recalibrated zones */ },
  "weeks_updated": 8
}
```

`weeks_updated` = number of weeks from the current week to end of plan.

## Error responses

| Status | Condition |
|--------|-----------|
| 401 | No valid session |
| 403 | Free tier |
| 404 | No plan found — the runner genuinely has no plan. ⚠️ **Until 2026-09-25 this also fired for runners who DID have one** (`RECALIBRATE-ZONES-COOKIE-CLIENT-01`): the route authenticates off the Bearer token but read the plan with the cookie client, and on native the cookie session is absent, so the read hit RLS with no session and returned nothing. It now uses the service client and passes the gist/legacy fallback, so an un-migrated `plans` row self-heals rather than 404ing. |
| 422 | Invalid or missing benchmark fields |
| 500 | Unexpected server error |

## Notes

- Recalculates VDOT from the new benchmark, then updates pace/HR targets for all sessions from the current week onwards.
- Uses `applyRecalibration()` from `lib/plan/ruleEngine.ts`.
- Saves updated plan via `savePlanForUser` (archives previous plan to `plan_archive`).
- Does not affect completed weeks.
