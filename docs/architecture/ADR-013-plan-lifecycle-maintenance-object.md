# ADR-013 — Plan lifecycle: post-race maintenance is its own plan object

**Status:** Accepted (2026-08-02)
**Supersedes (in part):** the MAINT-04/05 "appended, same-object" model for maintenance.

## Context

Post-race maintenance (§75) was implemented (MAINT-01/03/04/05) by **appending** maintenance weeks to the finished race plan's `plan_json`, keeping one `plans` row and continuing the race plan's `week_n` sequence. This meant a **finished race still presented as the active plan** — the plan title stayed the race name, Plan History showed it as "Current", and there was no clean point at which the race plan "ended". A live-data review of the founder's account confirmed the confusion: three weeks after Race to the Stones, the app still called that race the active plan.

The founder's directed model: **when a race completes, that plan ends and moves to history; the post-race maintenance block is a separate, live plan on its own terms.** SLT review (2026-08-02) unanimously endorsed this over the earlier "continuous cause, distinct chapter" compromise.

## Decision

Post-race maintenance is a **standalone plan object**, not appended weeks.

On race completion (race week date passed + `result_embedded` present), `/api/maintenance-block`:
1. Builds a maintenance-only plan: own weeks, `meta.plan_kind = 'maintenance'`, own display name (`After {race}`), `race_date` cleared (race-only UI no-ops), and `source_race_*` meta carried for post-race copy + the next-goal ladder.
2. Saves it as the active plan via `savePlanForUser`. Its **existing race-change archive guard** snapshots the completed race plan into `plan_archive` — reused, not duplicated.

Result: the race plan is in history (completed); the maintenance plan is the sole active plan.

## The `week_n` constraint (why continuous, not restart)

`week_n` is the shared key for `session_completions`, `session_reflections`, and `run_analysis`, and the app historically derived it from **array position** (which worked only because position == `week.n` in the appended model). The invariant relied on is therefore **`week.n`, not array position**.

- Maintenance `week_n` **continues the sequence (26+)**, so a standalone maintenance plan's completions never collide with the archived race plan's rows (1–25) under the same `user_id`. **No migration** to the completion/analysis tables.
- The app's week-number derivation was unified from array-position to canonical `week.n` (`PlanCalendar`, `TodayScreen`, `PlanScreen`, progress bar, weekly-note fetch). This is a **no-op on all pre-existing data** (position already equals `n`) and is what lets a short-array maintenance plan key correctly.

Rejected alternative: restart maintenance at `week 1` + add a `plan_id` scope column to the three tables (migration + backfill). Correct long-term, but higher blast radius; deferred unless multi-plan concurrency is needed.

## Consequences

- A finished race reads as completed in Plan History; maintenance is the only live plan. Matches the founder's + SLT's model.
- Post-race surfaces (transition announcement + seen-flag, ongoing "Base running" card, CA-03 next-goal ladder) re-key off the archived race week onto the maintenance plan's `plan_kind` / `source_*` meta so they survive the handoff.
- One `plans` row per user is preserved (no second live plan) — the ~15 single-plan call sites are untouched.
- Lifecycle: `race (active) → race completes → race archived (completed) + maintenance (active) → user generates next race → maintenance archived + new race (active)`.
- MAINT-04/05's appended-model seam and "Current"-race-row labelling are superseded.

## Amendment (2026-08-08) — the `week_n` unification of §22–27 was incomplete

§27 claimed week-number derivation had been "unified from array-position to canonical `week.n`". A live review of the founder's post-Race-to-the-Stones maintenance plan — the **first** plan where array position ≠ `week.n` (array 0–10, `week.n` 26–36) — showed the unification was both **incomplete and over-applied**, because `position == n` had masked every path on every prior plan:

- **Over-applied to display.** `PlanScreen` fed the `week.n` key (29) into `PlanArc`, which renders `Wk {n} of {length}` → **"Wk 29 of 11"**, and the bar strip never highlighted a current week. Today's header showed "Week 29" the same way.
- **Not applied to two routes.** `app/api/weekly-report/route.ts` and `app/api/plan-weekly-note/route.ts` still keyed by **array position** (`weekIndex + 1`; `plan.weeks[week_n - 1]`). On a maintenance plan the report read the archived race plan's rows at that index, and the plan-weekly-note lookup went out of bounds → 404 → the AI plan-voice card silently fell back to rule copy.
- **Coach keying used position.** `CoachScreen`'s `reportIsCurrent` / prev-week / phase-transition compared against the ordinal, not `week.n`.

**Resolution — the two numbers are now named and separated everywhere:**

| Quantity | Source | Used for |
|---|---|---|
| **`weekKey`** (canonical `week.n`) | `week.n ?? index+1` | every persisted week-scoped row: `session_completions`, `run_analysis`, `weekly_reports`, `plan_weekly_notes`, `session_reflections`, `phase_summaries`; and resolving a plan week from any of those keys |
| **`weekOrdinal`** (1-indexed array position) | `getCurrentWeekIndex(weeks) + 1` | the **only** value shown to the user ("Wk 4 of 11") or fed to `PlanArc` |

New shared helper `lib/plan.ts → findWeekByN(weeks, n)` resolves a week by `week.n` (never `weeks[n-1]`); both routes use it. Doctrine going forward: **`week_n` is a key, `week.n` resolves it, array position is display only.** Tested in `lib/planDateWindow.test.ts`.

## Follow-ons

- If true multi-plan concurrency is ever needed, revisit the `plan_id`-scoped-completions migration (the rejected alternative).
- `getCurrentWeekIndex`, `finishedRace`, reshape/adjustment engines were re-checked against the two-object (archived race + active maintenance) world; further post-race features must not assume the finished race lives in the active plan.
- **Fixed (2026-08-08):** the race→maintenance handoff archived the completed race plan **3×** (3 near-simultaneous saves each read the pre-handoff plan before any upsert landed). `savePlanForUser`'s archive guard is now idempotent — it skips the insert when an identical `race_name`+`race_date` snapshot was archived within a 10-minute recency window (dedupes the burst without blocking a genuine re-archive of the same race months later). The duplicate rows were also cleaned up on the founder's account. Residual: two *exactly* simultaneous callers can still race between the SELECT and the INSERT; the airtight fix is a unique index, deferred to avoid a migration. Tested in `lib/planArchiveGuard.test.ts`.

---

## Amendment (2026-09-18) — the collision this ADR solved for ONE transition returned on the other

**PLAN-WEEK-COLLISION-01.** §22 of this document reasons carefully about `week_n`
collisions and solves them for the race → maintenance handoff by continuing the
sequence at 26+, noting with satisfaction: *"a standalone maintenance plan's
completions never collide with the archived race plan's rows (1–25) under the
same `user_id`. **No migration** to the completion/analysis tables."*

§36 then states the full lifecycle:

> `race (active) → race completes → race archived (completed) + maintenance (active) → user generates next race → maintenance archived + new race (active)`

**The second arrow walks straight back into the hazard the first one avoided.** A
new race plan restarts `week.n` at 1, landing exactly on the archived race
plan's rows. And Follow-ons records that `plan_id`-scoped completions were
considered and **rejected** — correctly, for the transition being designed, and
that rejection then covered a transition nobody re-examined.

**Measured on production 2026-09-18.** A fresh 12-week 10K plan (Dorney Lake,
race 2026-12-12) rendered with **44 of its 47 sessions (94%) already marked
complete or skipped**, five linked to runs from the previous April. 150
completion rows spanning `week_n` 1–35 were live against a plan that owns 1–12.
Found because the founder opened his own plan and read it; nothing threw,
nothing logged, and every gate was green throughout.

### Why the sequence could not simply be continued again

`week.n` is not a free-running counter — **it carries meaning**. Foundation weeks
are numbered `i - weekCount`, i.e. negative (`foundationBlock.ts:367`), and the
engine uses `w.n > 0` as its "is this a main-plan week" guard in the taper and
peak passes (`ruleEngine.ts:3989`, `:4000`). Offsetting every week would push
foundation weeks positive and corrupt the taper curve; offsetting only `n > 0`
leaves foundation weeks colliding with each other. **This ADR's own mechanism
does not generalise, which is why the second transition needed a different
answer rather than the same one applied twice.**

### The resolution: mark, do not renumber and do not delete

A nullable `superseded_at` on the five week-keyed tables
(`session_completions`, `run_analysis`, `session_overrides`,
`session_metric_overrides`, `session_reflections`). `savePlanForUser` stamps it
on a **race-identity change** — at the exact point it already archives the plan
and already invalidates `plan_weekly_notes` on the argument that *"a cached note
narrating sessions that no longer exist is brand-destroying"*. Those rows **are**
the sessions that note was narrating.

- **Marked, not deleted**, because the time-windowed readers (aerobic trend,
  discipline ledger, reframe cohort, `v_coach_engagement`) aggregate across
  plans. Deleting would destroy a runner's training history to fix a display bug.
- **`week.n` is untouched**, so no coaching numeric moves and no plan is
  regenerated.
- **`isRaceIdentityChange` is one predicate**, shared by the archive decision and
  the stamp, so they cannot drift — the D-16 class that previously gave the tier
  ladder three copies and the deload cadence five.

### The rule this adds

> **`week_n` is a WITHIN-PLAN coordinate. It is never sufficient on its own to
> identify a row across plans.** Any table keyed on it must carry
> `superseded_at`, and any read that resolves a WEEK must filter on it. Reads
> that resolve a RUN (`apple_health_uuid`, `strava_activity_id`) must **not** —
> `run_analysis` is `UNIQUE (user_id, apple_health_uuid)`, so hiding a superseded
> row makes the caller believe none exists and the follow-up insert violates the
> constraint.

Mechanically enforced by `lib/plan/supersedeCoverage.test.ts`, which walks the
source and fails the build on an unfiltered week-keyed read, with an argued
allowlist. Observed in production by `lib/ops/planWeekCollision.ts`, running
inside the daily plan audit.
