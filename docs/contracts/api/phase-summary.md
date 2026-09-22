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
| `transition_week_n` | Yes | Canonical `week.n` of the first week of the new phase (ADR-013 — not array position; matched via `w.n === transition_week_n`) |

## Response — 200

```json
{
  "content": "You ran 87% of your Base phase sessions and kept your easy runs honest — 74% in Zone 2 on average...",
  "cached": false
}
```

| Field | Type | Description |
|-------|------|-------------|
| `content` | `string` | 2–3 sentence AI coaching summary in Zonna voice |
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
- `session_completions` — completion counts per phase week. Selected as
  `week_n, session_day, status, rpe, fatigue_tag, avg_hr, strava_activity_id, apple_health_uuid`.
  ⚠️ **NOT `session_type` — that column has never existed** (AI-COMPLETION-COLUMN-01,
  2026-09-22). It was selected here until then, so the query failed, the error was
  destructured away, and `?? []` made the array empty for the feature's whole life. The type
  is resolved from the **plan** via `withSessionType()` → `coachingSessionType` (INV-CLASS),
  joined on `(week_n, session_day)`.

  🔴 **`completionRate` is `null` when the completions read fails, never 0.** It was
  `completed / totalSessions` on an always-empty array — `0 / N` — so the model was told, as
  a number, that the runner completed **0% of the phase**, and wrote a coaching note on that
  basis. Unknown must not render as zero.

## Prompt source

`lib/coaching/prompts/phaseSummary.ts → buildPhaseSummaryPrompt()`

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
**`lib/ai/callAnthropic.ts`**, the single owner, as surface **`phase-summary`**.

- **Behaviour is unchanged.** Same URL, same headers, same body, same silent
  fallback (ADR-006 — the deterministic path always succeeds, AI is enrichment).
- **Every call is now recorded**: `ai_call` with real token counts and an
  estimated cost, or `ai_call_failed` with the reason, status and a truncated
  body. Read them at `GET /api/ops/ai-spend`.
- **A 2xx whose body is not JSON is now a failure**, not an empty answer. This
  route previously could not tell those apart.
- `noRawAnthropicCalls.test.ts` fails the build if this file names
  `api.anthropic.com` again. Full contract: `docs/contracts/api/ops-ai-spend.md`.
