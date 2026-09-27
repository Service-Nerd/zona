# API Contract — /api/adjust-plan

**Method:** POST  
**Auth:** Bearer token (paid/trial).  
**Gate:** `dynamic_reshape_r20` — returns 403 for free tier.

## Request body

All fields optional. Signals determine which trigger fires.

```json
{
  "manual": true,
  "rpe": 8,
  "sessionType": "easy",
  "skipReason": "Life got busy",
  "sessionDay": "week_3_tue",
  "fromDay": "tue",
  "toDay": "thu"
}
```

| Field | Trigger | Notes |
|-------|---------|-------|
| `manual: true` | Manual reshape (T-manual) | Forces confirmation regardless of risk level |
| `rpe` + `sessionType` | T5 — RPE disconnect | `rpe ≥ 8` on `easy`/`long` fires coach note |
| `skipReason` + `sessionType` + `sessionDay` | T2 — Skip with reason | Reasons: `"Too tired"` / `"Life got busy"` / `"Bad weather"` / `"Injury / illness"` |
| `fromDay` + `toDay` | T1 — Session reorder | Day keys: `mon`–`sun` |
| _(empty body)_ | Auto triggers (T3-T4) | Runs full trigger stack; respects `dynamic_adjustments_enabled` opt-out |

`skipReason` and `fromDay/toDay` signals bypass the `dynamic_adjustments_enabled` opt-out (user-initiated).

## Response — 200 (adjustment found)

```json
{
  "adjustment": { "id": "uuid", "status": "pending", "trigger_type": "skip_with_reason", "summary": "...", "sessions_before": [...], "sessions_after": [...] },
  "requires_confirmation": true
}
```

## Response — 200 (no adjustment needed)

```json
{ "adjustment": null, "message": "No adjustment needed" }
```

## Response — 200 (opt-out)

```json
{ "skipped": true, "reason": "user_disabled" }
```

## Error responses

| Status | Condition |
|--------|-----------|
| 401 | No valid session |
| 403 | Free tier |
| 404 | No plan found |
| 500 | DB insert failed |

## Notes

- Returns existing pending adjustment if one already exists (deduplication).
- Auto-applied (low-risk) adjustments update the plan immediately and return `status: "auto_applied"`.
- Hard caps: max 2 adjustments/week, 3-week taper protection (bypassed for T1/T2).
- AI explanation via claude-haiku (max 150 tokens). Silent fallback to rule-based summary.
- Trigger priority: T1 skip → T1 reorder → guard check → T4 fatigue → T3 acute/chronic → zone drift → shadow load → EF decline → T5 RPE.

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

## The Anthropic call — OPS-AI-OWNER-01 (2026-09-20)

This route no longer calls Anthropic directly. It goes through
**`lib/ai/callAnthropic.ts`**, the single owner, as surface **`adjust-plan`**.

- **Behaviour is unchanged.** Same URL, same headers, same body, same silent
  fallback (ADR-006 — the deterministic path always succeeds, AI is enrichment).
- **Every call is now recorded**: `ai_call` with real token counts and an
  estimated cost, or `ai_call_failed` with the reason, status and a truncated
  body. Read them at `GET /api/ops/ai-spend`.
- **A 2xx whose body is not JSON is now a failure**, not an empty answer. This
  route previously could not tell those apart.
- `noRawAnthropicCalls.test.ts` fails the build if this file names
  `api.anthropic.com` again. Full contract: `docs/contracts/api/ops-ai-spend.md`.
