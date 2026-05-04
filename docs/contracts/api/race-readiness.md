# API Contract — /api/race-readiness

**Method:** POST  
**Auth:** Supabase session required. Returns 401 if unauthenticated.  
**Gate:** `activity_intelligence` (PAID/TRIAL). Returns 403 for free users.

## Request body

Empty (`{}`) — all data derived from the user's plan and Supabase coaching records.

## Response — 200

```json
{
  "content": "Zone discipline held at 79% across the plan — that's the foundation the taper is built on...",
  "cached": false
}
```

| Field | Type | Description |
|-------|------|-------------|
| `content` | `string` | 2–3 sentence AI pre-race readiness assessment in Zona voice |
| `cached` | `boolean` | `true` if returned from the `race_readiness_notes` cache, `false` if freshly generated |

## Error responses

| Status | Condition |
|--------|-----------|
| 401 | Missing or invalid session |
| 403 | Free tier user |
| 404 | No plan found, or plan has no `race_date` |
| 422 | `daysToRace < 0` (race already passed) or `daysToRace > 14` (outside generation window) |
| 503 | AI generation failed (ephemeral — no row written) |

## Idempotency

Keyed on `(user_id, race_date)` via the `race_readiness_notes` primary key. Subsequent calls for the same race return the cached row without re-generating. A new plan with a different race date generates a fresh row.

## Generation window

Only generated when `daysToRace ∈ [0, 14]`. The route enforces this — calls outside the window return 422. CoachScreen enforces the same condition client-side before calling.

## Caching / display window

- Stored in `race_readiness_notes` table. One row per `(user_id, race_date)`.
- Card shown from generation until race day (inclusive, `daysToRace = 0`).
- Race readiness (R29) suppresses phase-end summary (R28) when both conditions apply.

## Data used by the route

- `plans` — race name, race date, race distance, week phases (for current phase), total planned sessions
- `user_settings` — `first_name` for personalised greeting
- `run_analysis` — `hr_in_zone_pct`, `ef_trend_pct`, `actual_load_km` across entire plan (manual excluded)
- `session_completions` — completion counts (whole plan) + `rpe` on easy/recovery sessions in last 3 weeks

## Prompt source

`lib/coaching/prompts/raceReadiness.ts → buildRaceReadinessPrompt()`
