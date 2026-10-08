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

## Display units — PROMPT-UNITS-ADJUST-01 (2026-10-06)

This route now **reads `getUserDisplayPrefs(supabase, user.id)`** and threads `units`
into `buildAdjustmentExplanationPrompt`. It did not before, and the consequence was
user-facing: **a miles runner received a km-voiced explanation of their own plan
change**, and the structural diff fed to the model was in kilometres too, because
every `summariseDiff` line runs through `labelSession`, which formats a distance.

ADR-015 Amendment governs this: **the AI layer is a display surface.** A number handed
to the model becomes user-facing the moment the model repeats it.

- `buildAdjustmentExplanationPrompt(adjustment, units, athleteContext?, previousAdjustment?)`
  — `units` is **required and second**. Required because a default is exactly what let
  this defect exist; second because TypeScript will not take a required parameter after
  an optional one.
- `summariseDiff(diff, { units })` carries it to all seven `labelSession` call sites.
- **Two halves, and a test must cover both.** `units` reaches the prompt by two
  independent paths — the `buildVoiceHeader` instruction line (*"The runner measures
  distance in MILES"*) and the diff lines. A test asserting only the diff stays green
  when the header is hardcoded back; `adjustmentUnits.test.ts` asserts both, and that
  arm exists because the falsification did not go red without it.
- No request or response shape changes. An unset preference resolves to `'km'` inside
  `getUserDisplayPrefs`, as every other surface already does.

## The week handed to the engine — seven real slots (ADJUST-ENGINE-DEAD-01, 2026-10-08)

`currentWeekSessions` MUST be **exactly seven non-null `Session` objects, mon=0 … sun=6**,
produced by `lib/plan/weekSessions.ts → orderedWeekSessions(week)`. Nothing else is a valid
input, and the route must not build this array itself.

🔴 **This is contracted because getting it wrong took the whole engine down for 104 days.**
`Week.sessions` is `Partial<Record<Day, Session>>` and the generator omits a rest day's key,
so **no real plan carries seven days** (measured across all 31 live plans:
`1×1 · 2×2 · 3×13 · 4×10 · 5×2 · 6×3`). The route previously passed
`DAY_ORDER.map(d => week.sessions[d] ?? null)` and `checkAdjustmentTriggers` throws on a
null slot, so **31 of 31 plans threw on every check** from 2026-06-26 to 2026-10-08.

⚠️ **The throw is correct and must not be relaxed.** `{...null}` is `{}` in JavaScript, so a
null slot would pass through all eleven positional `sessions.map(s => ({...s}))` consumers
in the engine as a typeless object and corrupt a reshape with **no error**. The assertion is
the only thing standing between a sparse week and a silently wrong plan.

**An absent day becomes an explicit `{type:'rest', label:'Rest', detail:null}`.** §64 as
amended by GEN-FIX-09 declares the explicit entry and the absent day to be equally valid
representations of a rest day, so this conversion is lossless and sanctioned rather than a
workaround.

⚠️ **Failure mode to know when reading logs:** the route 500s **before**
`recordAdjustmentCheck`, so a throw here leaves `last_adjustment_check_at` untouched and the
Me screen's "Last checked …" line simply never advances. Every client caller is
`void authedFetch(...)` with no `res.ok`, so the 500 is discarded on the way back too. A
broken engine is indistinguishable from an engine with nothing to suggest.
