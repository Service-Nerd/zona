# API Contract — /api/maintenance-block

**Method:** POST  
**Auth:** Bearer token required (uses service-role client — safe for native iOS where cookie session is absent). Returns 401 if unauthenticated.  
**Gate:** None for structure — plan structure generation is FREE and always runs. AI coaching voice enrichment is PAID, gated by `maintenance_coaching` (MAINT-02, wired 2026-07-30). Trial/paid users get enriched maintenance weeks; free/expired users get the rule-engine block unchanged. Enricher failure is silent (ADR-006) — the block is always returned regardless.

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

For trial/paid users the appended maintenance weeks additionally carry AI voice: each session gets `coach_notes`, and each week gets a `coach_debrief` string (one flat, factual sentence per §75). `coach_debrief` is absent when the user is free/expired or the enricher failed.

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
- AI enricher lives in `lib/plan/enrichMaintenance.ts → enrichMaintenanceBlock()` (MAINT-02). Called by the route after generation, only when `isFeatureAllowed('maintenance_coaching', tier)`. Same hybrid pattern as `lib/plan/enrich.ts` — Haiku (`ANTHROPIC_MODEL`), Zod-validated output, silent failure returns the rule-engine weeks unchanged. Adds `coach_notes` per session + `coach_debrief` per week. Voice register locked in §75. Rendered on the Today maintenance card with a `CoachByline` + moss rail (Pattern 16b); the rule-engine fallback line carries no provenance mark.
- The saved maintenance plan's `meta` carries the finished race forward via `source_race_name`, `source_race_distance_km`, `source_race_date`, `source_race_outcome`, `source_finish_time` (while `race_date` is cleared to `''`, since there is no upcoming race). **`source_race_date` is required for correct post-race coaching recency** — `sessionFeedback` computes "N weeks since the race" from it; without it the model fabricates the elapsed time. Registered in `PlanMetaSchema` so a re-parse doesn't strip them.
- Maintenance weeks carry `phase: 'maintenance_restoration'` (Phase 1) or `phase: 'maintenance_base'` (Phase 2).
- Durations are distance-keyed; modifiers for RPE ≥ 8 (+1 week) and DNF (+1 week) stack.
- All coaching numerics live in `GENERATION_CONFIG.POST_RACE_MAINTENANCE_BLOCK`.
- Constitutional invariants enforced by `validateMaintenanceBlock()` in `lib/plan/invariants.ts`.
- See `docs/canonical/CoachingPrinciples.md §75` for the principle behind all maintenance block decisions.

## Client integration

`DashboardClient` calls this route from a `useEffect` that fires when `finishedRace` is non-null and no maintenance weeks exist in the loaded plan. On success, calls `setPlan(data.plan)` to update local state immediately. authedFetch never throws on 4xx/5xx — callers must check `res.ok`.

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
**`lib/ai/callAnthropic.ts`**, the single owner, as surface **`enrich-maintenance`**.

- **Behaviour is unchanged.** Same URL, same headers, same body, same silent
  fallback (ADR-006 — the deterministic path always succeeds, AI is enrichment).
- **Every call is now recorded**: `ai_call` with real token counts and an
  estimated cost, or `ai_call_failed` with the reason, status and a truncated
  body. Read them at `GET /api/ops/ai-spend`.
- **A 2xx whose body is not JSON is now a failure**, not an empty answer. This
  route previously could not tell those apart.
- `noRawAnthropicCalls.test.ts` fails the build if this file names
  `api.anthropic.com` again. Full contract: `docs/contracts/api/ops-ai-spend.md`.

## Display units in the enrichment prompt (UNITS-PROSE-01, 2026-09-23)

`enrichMaintenanceBlock`'s context carries a **required** `units` field, so the prompt quotes the
race distance in the units the runner reads (ADR-015's amendment — the AI layer is a display
surface). No request or response shape changed.

- ⚠️ **Read with the SERVICE client, deliberately.** The first cut created a
  `createUserScopedClient` here and `rlsCoverage.test.ts` went red — not on this read, but on
  another operation in the route, because introducing a JWT client into a service-role route makes
  every operation in it ambiguous, and **under a JWT client an unpermitted write no-ops silently**.
  This route already holds `serviceClient` and the user is already authenticated.
- ⚠️ `units` is **required, not optional**: an optional field lets a new caller omit it silently
  and get kilometres.
