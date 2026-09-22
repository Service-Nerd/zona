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
| `content` | `string` | 2–3 sentence AI pre-race readiness assessment in Zonna voice |
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
- `session_completions` — completion counts (whole plan) + `rpe` on easy/recovery sessions in last 3 weeks.
  Selected as `week_n, session_day, status, rpe, fatigue_tag, avg_hr, strava_activity_id, apple_health_uuid`.
  ⚠️ **NOT `session_type` — that column has never existed** (AI-COMPLETION-COLUMN-01,
  2026-09-22). The easy/recovery filter therefore ran against an empty array and **had never
  once matched**, so `recentEasyRpe` was always null. The type is resolved from the **plan**
  via `withSessionType()` → `coachingSessionType` (INV-CLASS), and the filter runs on the
  TYPED rows — filtering the raw ones compiles, passes tsc, and matches nothing.

## Prompt source

`lib/coaching/prompts/raceReadiness.ts → buildRaceReadinessPrompt()`

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

## The Anthropic call — OPS-AI-OWNER-01 (2026-09-20)

This route no longer calls Anthropic directly. It goes through
**`lib/ai/callAnthropic.ts`**, the single owner, as surface **`race-readiness`**.

- **Behaviour is unchanged.** Same URL, same headers, same body, same silent
  fallback (ADR-006 — the deterministic path always succeeds, AI is enrichment).
- **Every call is now recorded**: `ai_call` with real token counts and an
  estimated cost, or `ai_call_failed` with the reason, status and a truncated
  body. Read them at `GET /api/ops/ai-spend`.
- **A 2xx whose body is not JSON is now a failure**, not an empty answer. This
  route previously could not tell those apart.
- `noRawAnthropicCalls.test.ts` fails the build if this file names
  `api.anthropic.com` again. Full contract: `docs/contracts/api/ops-ai-spend.md`.
