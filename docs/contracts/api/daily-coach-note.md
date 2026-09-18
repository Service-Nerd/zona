# API Contract — /api/daily-coach-note

**Method:** GET  
**Auth:** Supabase session required. Returns 401 if unauthenticated.  
**Gate:** `activity_intelligence` (PAID_ONLY_ONGOING). Returns 403 for free users. Client-side gate skips the fetch entirely for free users.

## Query parameters

| Param | Required | Description |
|-------|----------|-------------|
| `date` | No | User's local date `YYYY-MM-DD`. Defaults to UTC date if absent. |
| `force` | No | `true` to regenerate even if a cached note exists for this date. |

## Response — 200

```json
{ "note": "Hard day tomorrow. Keep today genuinely easy." }
```

## Error responses

| Status | Condition |
|--------|-----------|
| 401 | Missing or invalid session |
| 403 | Free tier user |
| 404 | No plan found for user |

## Caching behaviour

- One row per `(user_id, note_date)` in the `daily_coach_notes` table.
- On a cache hit (and `force` not set), returns the cached note immediately — no AI call.
- On a cache miss or `force=true`, generates via Claude (claude-haiku), upserts the row, returns the note.
- Silent fallback: if AI generation fails, returns `null` note rather than erroring. Client handles `null` gracefully (no note shown).

## Notes

- `date` should be the user's local calendar date, not UTC — pass `new Date().toLocaleDateString('en-CA')` from the client.
- Strength sessions are excluded from coaching context (feature not fully built).
- Prompt source: `lib/coaching/prompts/dailyCoachNote.ts`.

## Data scoping — PLAN-WEEK-COLLISION-01 (2026-09-18)

Every read this route makes against a **week-keyed** table
(`session_completions`, `run_analysis`, `session_overrides`,
`session_metric_overrides`, `session_reflections`) filters
`superseded_at IS NULL`, so it sees the LIVE plan only.

`week_n` is a within-plan coordinate: a new race plan restarts `week.n` at 1 and
would otherwise resolve against the previous plan's rows. No request or response
shape changes — this is a scoping guarantee, and the route's output for a runner
on their first plan is byte-identical to before.

⚠️ Reads that resolve a **RUN** rather than a week (`apple_health_uuid`,
`strava_activity_id`) are deliberately NOT filtered: `run_analysis` is
`UNIQUE (user_id, apple_health_uuid)`, so hiding a superseded row would make the
caller believe none exists and the follow-up insert would violate the constraint.

Enforced by `lib/plan/supersedeCoverage.test.ts`.
