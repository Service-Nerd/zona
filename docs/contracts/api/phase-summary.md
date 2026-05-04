# API Contract — /api/phase-summary

**Method:** POST  
**Auth:** Supabase session required. Returns 401 if unauthenticated.  
**Gate:** `activity_intelligence` (PAID/TRIAL). Returns 403 for free users.

## Request body

```json
{
  "phase_ended": "base",
  "transition_week_n": 5
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `phase_ended` | Yes | Phase that just finished: `'base'` \| `'build'` \| `'peak'` \| `'foundation'` |
| `transition_week_n` | Yes | Plan week number when the new phase starts (first week of new phase) |

## Response — 200

```json
{
  "content": "You ran 87% of your Base phase sessions and kept your easy runs honest — 74% in Zone 2 on average...",
  "cached": false
}
```

| Field | Type | Description |
|-------|------|-------------|
| `content` | `string` | 2–3 sentence AI coaching summary in Zona voice |
| `cached` | `boolean` | `true` if returned from the `phase_summaries` cache, `false` if freshly generated |

## Error responses

| Status | Condition |
|--------|-----------|
| 401 | Missing or invalid session |
| 403 | Free tier user |
| 404 | No plan found for user |
| 422 | Missing `phase_ended` or `transition_week_n` in body |
| 503 | AI generation failed (ephemeral — no row written; client should not surface this to user) |

## Idempotency

Keyed on `(user_id, phase_ended, transition_week_n)` via the `phase_summaries` primary key. Subsequent calls for the same phase transition return the cached row without re-generating.

## Caching / display window

- Stored in `phase_summaries` table. One row per `(user_id, phase_ended, transition_week_n)`.
- CoachScreen shows the card for the duration of the transition week only (the first week of the new phase). Natural 7-day window — user is in that week, not the previous one.
- Card is suppressed when race readiness (R29) is active (`daysToRace ≤ 14`).

## Data used by the route

- `plans` — identifies weeks belonging to the completed phase, derives next phase name
- `user_settings` — `first_name` for personalised greeting
- `run_analysis` — `hr_in_zone_pct`, `ef_trend_pct`, `actual_load_km` per session (Strava/AH only, manual excluded)
- `session_completions` — completion counts per phase week

## Prompt source

`lib/coaching/prompts/phaseSummary.ts → buildPhaseSummaryPrompt()`
