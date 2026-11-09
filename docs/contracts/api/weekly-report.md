# API Contract — /api/weekly-report

**Method:** POST  
**Auth:** Bearer token (paid/trial). Internal cron path: `x-service-key` + `x-user-id` headers bypass auth check.  
**Gate:** `activity_intelligence` — returns 403 for free tier.

## Query params

| Param | Default | Notes |
|-------|---------|-------|
| `force` | `false` | Set `?force=true` to regenerate an existing report for this week |

## Request body

Empty body accepted.

## Response — 200

```json
{
  "report": {
    "id": "uuid",
    "user_id": "uuid",
    "week_n": 3,
    "headline": "Solid week.",
    "body": "Zone discipline was good. Load was within range.",
    "cta": "Keep the easy days easy.",
    "zone_discipline_pct": 84,
    "load_ratio": 1.1,
    "sessions_completed": 4,
    "sessions_planned": 5,
    "rule_engine_version": "1.0.0",
    "created_at": "2026-04-29T10:00:00Z"
  },
  "cached": false
}
```

> 🔴 **`total_km_planned` IS SUMMED FROM THE SESSIONS SINCE 2026-11-09** (`RACE-WEEK-ZERO-KM-01`).
> It is `plannedCoveredKm(week)` from `lib/plan/weekVolume.ts` — the **single owner** of
> the basis — which sums the week's sessions through `sessionKmSelfPaced`, race included.
> It is **not** `week.weekly_km`, for three measured reasons: §121 excludes the race from
> `weekly_km` on ENGINE output but a legacy stored plan can include it (`e916f15a` wk25
> reads 105 for 2 + 3 + a 100 km race, so adding the race again gave 205); `weekly_km` is
> ROUNDED while a session sum is not (|diff| across 632 stored weeks: median 0.39, p90
> 1.05, **max 37.00**); and a missing `weekly_km` would render as "vs — planned".
> The basis is set by the ACTUAL (`linkedKm + offPlanKm` includes the race the runner ran),
> so a race-exclusive planned figure made it apples to oranges: on race week this read
> **0** and the prompt said *"42.2km actual vs 0.0km planned"*.
>
> ⚠️ **`plannedKmToDate` uses the SAME owner** (`plannedCoveredKmOnDays`). It summed
> `distance_km ?? 0`, which asserts a duration-anchored session covered no ground
> (`SESSION-KM-01/02`): **229 of 632 stored weeks hold a null-distance session**, and on
> `f3ae3cba` weeks 1-3 it computed **0.0 km against a real 13.1**.
>
> ⚠️ **§121 itself is unchanged** — `weekly_km` still excludes the race and `trainingKm` is
> still what the runner TRAINS. This route asks a different question.
> ⚠️ **The prompt names the race rather than folding it** (§121 Amendment 1, Sims, binding):
> `"42.2km actual vs 42.2km planned (incl. 42.2km race)"`. Off race week the clause is
> inert and every prompt is byte-identical.

`cached: true` when an existing report was returned without regeneration.

## Error responses

| Status | Condition |
|--------|-----------|
| 401 | No valid session |
| 403 | Free tier |
| 404 | No plan or no current week |
| **429** | **Per-user AI rate limit exceeded (SEC-15, 2026-09-20).** Interactive callers only — the internal cron path (`x-service-key` + `x-user-id`) is deliberately NOT limited, because rate-limiting it would silently stop a runner's scheduled report. ⚠️ Not a hard cap: `checkAiRateLimit` FAILS OPEN on an RPC error or unreachable DB, by design. |

## Notes

- Returns existing report for the current week unless `?force=true`.
- Keyed by the current week's canonical `week.n` (ADR-013), not array position — so `session_completions` / `run_analysis` reads land on the maintenance plan's rows (26+), never the archived race plan's rows at the same array index.
- Aggregates `session_completions` + `run_analysis` + load history for the current week.
- AI generates Headline/Body/CTA via claude-haiku (max 300 tokens). Silent fallback to rule-based strings.
- Internal cron path used by `/api/push/send-weekly-report`.

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

## The WRITE side — WEEKLY-REPORT-SUPERSEDED-WRITE-01 (2026-11-02)

🔴 **The section above documented the reads and the write was still colliding.** This route
upserted `weekly_reports` with `onConflict: 'user_id,week_n'` against a plain
`UNIQUE (user_id, week_n)` — not plan-scoped. A new plan restarts `week.n` at 1, so the
upsert found the PREVIOUS plan's week-1 row, updated it in place and inherited its
`superseded_at`. The write succeeded, every read above excluded it, nothing errored.

**Measured in production before the fix:** 30 rows, 14 live, 16 superseded, **1 ghost write**
— one runner's week 1, superseded 2026-10-18 and rewritten 2026-10-25. Both halves were lost:
the live report did not exist, and the archived plan's week-1 narrative was overwritten.

The write now goes through `lib/supabase/liveRowWrite.ts → writeLiveRow`, which reads the
LIVE row's primary key and UPDATEs by `id` (unreachable for a tombstone) or INSERTs. The
partial index `weekly_reports_live_key` (`20261102_live_week_keys.sql`) makes "at most one
LIVE row per (user, week)" the constraint, so a new plan inserts beside its history.

**No request or response shape changes.** The runner still receives the report in the POST
response even if the write fails; what is lost is the cache. A failure records
`weekly_report_write_failed` via `recordOpsEvent` — never swallowed, because the only
alternative to failing is writing the superseded row, which is the defect.

⚠️ `onConflict` is unavailable for this: PostgREST emits `ON CONFLICT (cols) DO UPDATE` with
no predicate and Postgres will not match that to a PARTIAL index.

Enforced by `lib/supabase/liveRowWrite.test.ts` — behavioural arms plus a population arm that
reads the source and fails on any new blind upsert of a `WEEK_KEYED_TABLES` table.


## The Anthropic call — OPS-AI-OWNER-01 (2026-09-20)

This route no longer calls Anthropic directly. It goes through
**`lib/ai/callAnthropic.ts`**, the single owner, as surface **`weekly-report`**.

- **Behaviour is unchanged.** Same URL, same headers, same body, same silent
  fallback (ADR-006 — the deterministic path always succeeds, AI is enrichment).
- **Every call is now recorded**: `ai_call` with real token counts and an
  estimated cost, or `ai_call_failed` with the reason, status and a truncated
  body. Read them at `GET /api/ops/ai-spend`.
- **A 2xx whose body is not JSON is now a failure**, not an empty answer. This
  route previously could not tell those apart.
- `noRawAnthropicCalls.test.ts` fails the build if this file names
  `api.anthropic.com` again. Full contract: `docs/contracts/api/ops-ai-spend.md`.

## Date arithmetic (DATE-DST-01, 2026-09-21)

`dayIndex` — which drives the user-facing "it is currently {dayOfWeek}" line and the split between
sessions already due and sessions remaining — now comes from `calendarDaysBetween`
(`lib/dates.ts`), not a millisecond quotient. Across a spring-forward two local midnights are 23
hours apart, so on that one Sunday the index read 5 and the report silently described the week as
one day earlier than it was. Same computation as `lib/coaching/dayBoundary.ts` (§65); the
duplication predates this change and is not resolved by it. **Request and response shapes are
unchanged.**

## Weekly load — LOG-OFFPLAN-01 (Coaching Board 2026-09-27)

The week's load figure no longer comes from a hand-rolled sum over
`run_analysis`. `lib/coaching/weeklyActualLoad.ts → fetchWeeklyLoad()` is the
**single owner**, and it reads the **activity log** (`strava_activities`), which
holds every ingested run whether or not it matched a prescribed session.

It returns two figures per plan week, and **which trigger reads which is the
board's ruling, not an implementation detail**:

| Figure | Read by | Why |
|---|---|---|
| `linkedKm` | **acute:chronic ratio**, `priorWeeksKm` | `acute_chronic_high` calls `buildReduceVolumeAdjustment`, which trims easy and long sessions ~15% and only `requiresConfirmation` at `LOAD_RATIO.flag` — below that it applies **silently**. **Clause 2:** a runner's own extra easy run must not shrink next week without them asking |
| `linkedKm + offPlanKm` | **shadow load**, `total_km_actual` | **Clause 1:** actual load is a measurement of what happened, and excluding real running makes it wrong. `buildShadowLoadAdjustment` copies `sessionsBefore` into `sessionsAfter` unchanged and reports *"Flagged — no auto-change applied"* — it was already clause 2's shape |

**Measured on production 2026-09-27:** of runs that happened while a plan
existed, **21 of 78 (26.9%) were off-plan, carrying 173 km of 848 (20.4%)**.
Those runs are shorter and *more* zone-disciplined than prescribed ones
(median 7.5 vs 8.0 km; 68.8% vs 60.0% in Z2), so this is ordinary aerobic
volume, not hidden hard training.

⚠️ **That 26.9% counts runs after the plan ROW was created; the owner is stricter** — `isInsidePlanWeek` keeps only runs inside an actual plan WEEK, so it is an upper bound. On production today the shipped path sees **3 plan-weeks with any logged run and produces zero new `shadow_load` flags**, because 15 of 25 live plans have not reached their first week.

⚠️ **Two corrections folded into the owner, because the raw sum is wrong
without them.** Runs that **predate the plan** are dropped (HealthKit history
backfill — 79% of the naive figure), and rows describing the **same physical
run ingested twice** are collapsed (63 km, 4.2% of the log).

⚠️ **No request or response shape changes.** For a runner who logs only what was
prescribed, `offPlanKm` is 0 and the route's output is byte-identical to before.

⚠️ **Clause 3 is NOT implemented.** Including off-plan volume in §2's injury cap
was ruled CORRECT and is blocked on sample size. The cap still reads `linkedKm`.

Enforced by `lib/coaching/offPlanLoad.test.ts` and
`lib/coaching/weeklyActualLoad.test.ts`.

## Supabase client (2026-10-13)

This route built a cookie client (`createClient()` from `@/lib/supabase/server`) and never
called a method on it. Removed under `ADJUST-PLAN-SAVE-CLIENT-01`: unused, but the next
edit reaches for the nearest client in scope, and on a bearer-authenticated route that is
the one whose `auth.uid()` is NULL on native.


## Plan read — PLANS-SINGLE-NOT-MAYBE-01 (2026-10-16)

The `plans` row is read through `readPlanJson` (`lib/planRead.ts`), the one owner of that query. It uses
`.maybeSingle()`, so a runner with **no plan is `null` with no error**, not the PostgREST 406 that made up 89
of 94 Supabase warnings in a day. **A database error now answers `500 { error: 'Could not load your plan' }`.** It used to be indistinguishable from "no plan" and answered as if the runner had none.

## Race-week debrief — race analysis lookup (SHARE-WEEK-CARD-SOURCE-01, 2026-10-31)

The race day's `run_analysis` row is found by `session_day === raceDayKey` (the bare day, `sat`), inside a query already
scoped by `week_n`. It used to look for `week_N_<day>`, a format `session_day` has never had, so `zoneDirection` was always
`null` and the debrief never knew which way the race was paced. Gate: `lib/coaching/sessionDayShape.test.ts`.

## Execution ceiling

`export const maxDuration = 300` — this route can reach the model, so it states its own ceiling
rather than inheriting a platform default that has changed twice. The reasoning, the measured
durations and the client-side `AbortSignal` timeout are owned by
**`docs/contracts/api/ai-route-duration.md`** and are referenced, never restated here: fourteen
copies of one number is how the number drifts (`OPS-FN-DURATION-01`, 2026-11-08).
