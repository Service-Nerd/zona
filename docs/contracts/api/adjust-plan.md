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
input. ⚠️ **Since `ADJUST-ENGINE-ENTRY-01` the ROUTE does not build it at all** — it is
assembled inside `lib/coaching/adjustmentEngine.ts → buildAdjustmentSignals`, and the
route hands over rows.

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

## Supabase client — ADJUST-PLAN-SAVE-CLIENT-01 (2026-10-13)

**This route authenticates off the Bearer token, so every write must go through a client
that sets `auth.uid()` or deliberately bypasses RLS.** It passes **`createServiceClient`**
into `savePlanForUser`.

It previously passed the cookie client (`createClient()` from `@/lib/supabase/server`).
On native there is no cookie session, so `auth.uid()` is NULL, `plans` RLS refuses the
upsert and `savePlanForUser` throws — **after** the caller has already recorded its work.
Measured 3× on production, all one account, all
`new row violates row-level security policy for table "plans"`.

🔴 **THIS SECTION SAID `createUserScopedClient(req)` UNTIL 2026-10-15, AND IT WAS THE
REVERTED FIRST CUT OF THE FIX.** Written in `bead506a` and falsified by `4c6dfa97`
**the same day**; the doc kept the argument for the version that was abandoned.
**Service, not user-scoped, and the reason is a HELPER rather than a table:** the first
cut reasoned that `plans`, `plan_archive` and `plan_weekly_notes` all carry
`auth.uid() = user_id` policies so RLS could stay live — which checked what
`savePlanForUser` *writes* and not what it *calls*. It invokes `reanchorCharityGrant`,
which UPDATEs `charity_codes`, and a user-scoped client may only SELECT that table: the
write would have no-opped **silently** and charity grants would have stopped re-anchoring
to race day for the 500 Make-A-Wish runners. `rlsCoverage.test.ts` caught it.

⚠️ **AND NO GATE COULD SEE THE DIVERGENCE.** `lib/plan/planRouteClient.test.ts` accepts
**either** `createServiceClient` or `createUserScopedClient` — correctly, since which one
is right differs per route — so it was green against a contract that named the wrong one.
A doc claim is only ever as checked as the thing checking it. Found while writing
`ADJUST-ENGINE-ENTRY-01`; this is the fourth time in this repo that writing or revising a
contract surfaced something the code already knew.

## The engine entry point — ADJUST-ENGINE-ENTRY-01 (2026-10-15)

This route is no longer the orchestrator. The synchronous adjustment path lives behind
**`lib/coaching/adjustmentEngine.ts → runAdjustmentEngine()`**, which returns a
discriminated union and never throws a designed outcome:

```ts
type AdjustmentOutcome =
  | { kind: 'none' }
  | { kind: 'adjustment'; proposed; magnitude; requiresConfirmation;
      status: 'pending' | 'auto_applied'; updatedPlan; reshapeErrors; ruleEngineVersion }
```

**Engine imports: 14 → 5** (601 → 438 lines). The five the route keeps, and why each
one is the caller's, not an oversight:

| import | why it stays |
|---|---|
| `lib/coaching/adjustmentEngine` | the door itself |
| `lib/plan/canUseFeature` | the **403** paywall. A commercial gate at the auth boundary (ADR-003); a second consumer of a hosted engine would not apply Zonna's price list |
| `lib/coaching/weeklyActualLoad` | `fetchWeeklyLoad` is **I/O**. The fetch is the caller's; `priorWeeks` and the linked/off-plan split moved inside with the triggers that read them |
| `lib/coaching/prompts/planAdjustment` | the **AI layer** (ADR-006). It takes `units` and assembles runner-facing voice for a model the engine may not call; its failure must be silent, so it cannot be an engine outcome |
| `lib/coaching/prompts/athleteContext` | same |

⚠️ **Plus one the count's reader could not see: `from '@/lib/plan'` — the barrel.**
`getCurrentWeekIndex` is engine and is here out of **necessity** (it resolves `weekN`,
which scopes three of this route's own queries, so it must be known before the engine is
called); `savePlanForUser` is persistence. So **five on the contract's reader, six
counting the barrel**, and `engineContract.test.ts` now asserts both plus the exact
symbol set, so a third cannot join silently.

**What did NOT move, and must not:** auth, `getUserTier`, the paywall, every Supabase
read and write, `recordAdjustmentCheck`, `recordOpsEvent`, the notification sends, and
the Anthropic call.

### `acceptAiSummary` — the one assignment that is not generate-plan's

The engine exports a second function, and the asymmetry it encodes was argued rather than
inherited: the **prompt builders are the caller's**, the **summary validator is the
engine's**. `acceptAiSummary(proposed, text)` asks *"does this prose contradict what I
changed?"*, and the engine is the only thing holding the diff. **The fallback is still the
caller's** — on `ok: false` it keeps the rule-engine summary silently (ADR-006) and logs
`reason` so prompt drift surfaces.

⚠️ **It replaced a hand-assembled pair, and what removed the risk is a TYPE, not a test.**
The route used to call `computeSessionDiff` then `validateSummaryAgainstDiff` by name,
where a *mismatched* pair was expressible and silent. Taking the proposal makes the pair
unmakeable. ⚠️ **Measured: the validator is symmetric in before/after by construction** —
all three of its patterns union both sides and the changed-day set is identical under a
swap — so a swapped composition is **not detectable by any input**. Recorded in
`adjustmentOutcomeHandled.test.ts` so nobody adds a guard for a property that cannot be
guarded.

### The constitutional layer — the check moved, the reaction did not

`validateReshapedPlan` runs **inside** the engine, before anything is persisted, and
error-severity violations come back on the outcome. The route keeps its own dev/test
`throw new Error('reshape produced invalid plan: …')` and its production
`reshape_invalid` ops event **verbatim**, because both are observable and a refactor must
not quietly reword either.

**No request or response shape changes.** `{ adjustment, requires_confirmation }`,
`{ adjustment: null, message }`, `{ skipped: true, reason }`, 401/403/404/500/503 are all
byte-identical.

⚠️ **`verify:parity` cannot see any of this.** It calls `generateRulePlan` and never
`checkAdjustmentTriggers`, `computeReshapeMagnitude` or `runAdjustmentEngine` — zero
occurrences. The evidence is `adjustmentOutcomeHandled.test.ts` plus two gates that
stopped grepping this file and started calling the function: `weekSessions.test.ts` (a
sparse week survives the engine — the 104-day `ADJUST-ENGINE-DEAD-01` outage, as
behaviour) and `planAdjustment.test.ts` (§66 Am.1's two-axis comparability, as data).

## Walked end to end — ROUTE-E2E-ADJUST-01 (2026-10-15)

`lib/api/adjustPlanRoute.test.ts` executes `POST /api/adjust-plan`: **23 arms**, covering
auth → tier → `guardAiRequest` → the opt-out → the plan → the load → the engine →
persist → respond. Before it, nothing had ever run the handler — `tsc` caught a new
`AdjustmentOutcome` kind at the destructure and `adjustmentOutcomeHandled.test.ts` caught
an unhandled branch, but neither executes the route.

**Three mocks, all at IO boundaries:** `@supabase/supabase-js` (one fake `createClient`
serves every caller), `getUserFromRequest`, and `callAnthropic`. `getUserTier` →
`resolveTier`, `isFeatureAllowed`, `guardAiRequest`, `getUserDisplayPrefs`,
`fetchWeeklyLoad`, `runAdjustmentEngine` and everything behind it, the prompt builders,
`acceptAiSummary`, `savePlanForUser` with its real `PlanSchema`, `recordOpsEvent` and
`notifyUser` all run for real.

⚠️ **The fixture plan is generated by the real engine**, not hand-written.
`savePlanForUser` runs `PlanSchema` and **throws in test** on an invalid plan, and the
route runs `validateReshapedPlan` and throws on an error-severity violation — so a
hand-rolled plan fails for fixture reasons and reads as a route defect.

### The gate order, now pinned

**401 → 403 (`dynamic_reshape_r20`) → `guardAiRequest` → opt-out → 404 → 503 → engine.**

🔴 **Arm B4 is the one with no visible symptom.** A free-tier runner with no plan can be
answered **403** or **404**; the order decides which, and the runner is refused either
way. Flipping it tells someone whose problem is that they have not paid that no plan was
found. Same class as `ROUTE-E2E-GENERATE-01`'s 422-before-403 finding on the sibling route.

### What the stamp means, asserted three ways

`last_adjustment_check_at` reports that the **engine ran**, not that it changed something.
So 401 / 403 / `user_disabled` / 404 / 503 deliberately do **not** stamp, `adjustment:
null` stamps with `found_change: false`, and both the pending-dedup return and a real
adjustment stamp `true`.

### Two orderings that protect the records

- **Insert before save.** A failed `plan_adjustments` insert is **500** and the live plan
  is untouched — the inverse order would produce a changed plan with nothing recording it.
- **A failed save re-throws** after recording `plan_save_failed` with `route:
  'adjust-plan'`. ⚠️ The adjustment row is **already written** at that point; the event
  makes it visible and does not prevent it. Arm I2 asserts the row survives, so the event
  is not read as a fix.

⚠️ **WHAT THIS DOES NOT PROVE.** No Postgres — the double speaks PostgREST's shapes, not
RLS, constraints, triggers or real `or()` filtering, so `ADJUST-PLAN-SAVE-CLIENT-01` (an
RLS refusal) **could not** have been caught here; `planRouteClient.test.ts` guards that by
reading which client the route passes. `ADJUST-STATUS-WITHOUT-SAVE-01` is in
`confirm-adjustment` / `revert-adjustment`, different routes, still open. The 500 branch is
exercised for an insert failure only. Not the rate limiter (the fake's `rpc` returns `true`
and `checkAiRateLimit` fails OPEN by design). Not the push transport —
`push_subscriptions` is empty, so what is asserted is that the route *calls* `notifyUser`.

📐 **MEASURED: breaking the double's `eq()` is noticed by exactly ONE arm (A1).** The other
22 pass against a database ignoring its own filters. That is why arm A proves the harness
**positively** instead of inferring it from the green arms — the second time this property
has been measured in this repo, after `ROUTE-E2E-GENERATE-01`.


## Plan read — PLANS-SINGLE-NOT-MAYBE-01 (2026-10-16)

The `plans` row is read through `readPlanJson` (`lib/planRead.ts`), the one owner of that query. It uses
`.maybeSingle()`, so a runner with **no plan is `null` with no error**, not the PostgREST 406 that made up 89
of 94 Supabase warnings in a day. **A database error now answers `500 { error: 'Could not load your plan' }`.** It used to be indistinguishable from "no plan" and answered as if the runner had none.

## A change that breaks the plan is never offered — SKIP-MAKEUP-DAY-01 (2026-10-25)

🔴 **Found on the founder's own plan by the daily ops digest.** A Tuesday easy run skipped with
*"Life got busy"*, logged on the Sunday, produced a pending adjustment that **kept Tuesday's run
and added an empty "Make-up easy run" on Wednesday**, which was (a) a day he had said he cannot
train, (b) already past, and (c) no distance, time or pace. `reshape_invalid` fired, and the route
**wrote the pending row anyway**, because in production the check only logged.

**Two changes, one response shape that already existed:**

- **The route.** On error-severity violations in production it records `reshape_invalid` (now with
  `trigger` in `detail`) and returns `{ adjustment: null, message: 'No adjustment needed' }`. **No
  `plan_adjustments` row is written.** Dev/test still throws. This reverses "the reaction did not
  move" above for production only: offering a runner a change we have just measured as breaking
  their plan is not a soft degrade.
- **The make-up (`buildSkipAdjustment`).** The free day must be after the skipped day, **not
  before today** (`earliestDayIdx`, from the week's own date and `req.now`), and **not in
  `generator_input.days_cannot_train`** (`blockedDays`). The make-up **is the skipped session**
  (distance, time, pace, HR, zone) minus its `id`, relabelled. No such day → no make-up.

`session_reorder` is not the same defect: the runner chooses `toDay`.

Tests: `lib/coaching/planAdjustment.test.ts` § SKIP-MAKEUP-DAY-01, six arms, each falsified.
