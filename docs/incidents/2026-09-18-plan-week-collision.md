# 2026-09-18 — A brand-new plan arrived 94% already completed

**ID:** PLAN-WEEK-COLLISION-01 · **Severity:** Systemic, silent · **Users affected:** 1 of 26
**Found by:** the founder opening his own plan and reading it.

## What happened

A newly generated 12-week 10K plan (Dorney Lake, race 2026-12-12, saved
2026-09-17 20:12) rendered with **44 of its 47 sessions (94%) already marked
complete or skipped**, five of them linked to runs recorded the previous April.

## Mechanism

Three facts compose it:

1. **The key has no plan identity.** `session_completions` is
   `UNIQUE (user_id, week_n, session_day)`. Four sibling tables are the same
   shape: `run_analysis`, `session_overrides`, `session_metric_overrides`,
   `session_reflections`.
2. **New plans restart `week.n` at 1**, re-entering the range the archived plan
   already occupied. The founder held 150 completion rows spanning `week_n`
   1–35 (Race to the Stones, `n=1..25`, plus its maintenance block, `n=26..36`)
   against a new plan that owns 1–12.
3. **`savePlanForUser` did not clear them.** On a race-identity change it
   archived the prior plan, upserted the new one, deleted `plan_weekly_notes`
   and re-anchored the charity grant. The five week-keyed tables were untouched.
   The only `DELETE` on `session_completions` in the entire codebase is in
   `delete-account`.

The read had no guard either: `completionsMap[r.week_n][r.session_day]`
(`DashboardClient.tsx:901`) — no date check, no plan check.

## Why it survived

**ADR-013 solved this hazard for one transition and named the other in the same
document without solving it.** §22–26 reasons explicitly about `week_n`
collisions and fixes race → maintenance by continuing the sequence at 26+,
concluding *"never collide … **No migration** to the completion/analysis
tables."* §36 then states the lifecycle including `user generates next race →
maintenance archived + new race (active)` — the arrow that restarts numbering at
1. Follow-ons records that `plan_id`-scoped completions were **considered and
rejected**; correct for the transition being designed, and that rejection then
covered a transition nobody re-examined.

**`savePlanForUser` makes the argument for the fix twenty lines from where it
was needed:** it deletes `plan_weekly_notes` because *"a cached note narrating
sessions that no longer exist is brand-destroying"*. Those rows are the sessions
the note was narrating.

**Nothing could see it.** `validatePlan()` validates the plan OBJECT; the
collision lives in another table. No invariant reconciles persisted week-keyed
rows against the active plan. `npm run verify` passed throughout and always
would have. And it requires a completed plan lifecycle to manifest, which on 26
users is one person — the same "the corpus cannot reach it" shape as the
liveness-debt findings.

## The fix that was nearly shipped and was wrong

Continuing the week sequence — ADR-013's own mechanism — was recommended, agreed
by the founder, and abandoned on inspection. **`week.n` carries meaning**:
foundation weeks are numbered `i - weekCount`, i.e. negative
(`foundationBlock.ts:367`), and the engine uses `w.n > 0` as its "is this a
main-plan week" guard in the taper and peak passes (`ruleEngine.ts:3989`,
`:4000`). Offsetting every week would have pushed foundation weeks positive and
corrupted the taper curve. **A display defect would have been fixed by shipping
a coaching one.**

## What shipped

A nullable `superseded_at` on the five tables, stamped by `savePlanForUser` on a
race-identity change, at the same point it already archives and already
invalidates the weekly notes. Marked rather than deleted, because the
time-windowed readers (aerobic trend, discipline ledger, reframe cohort,
`v_coach_engagement`) aggregate across plans and deleting would destroy a
runner's training history to fix a display bug. `isRaceIdentityChange` is one
predicate shared by the archive and the stamp.

45 reads filtered. Run-keyed reads deliberately **not** filtered:
`run_analysis` is `UNIQUE (user_id, apple_health_uuid)`, so hiding a superseded
row makes the caller believe none exists and the follow-up insert violates the
constraint.

## Two things the fix got wrong on the way

Recorded because both were caught by mechanism rather than by care:

- **The bulk transform filtered run-keyed lookups**, which would have broken the
  HealthKit ingest path with a constraint violation. Caught by checking the
  unique constraints before trusting the transform.
- **The guard test found five sites the transform had silently skipped**, because
  its chain-walker stopped at comment lines. The guard caught the fix being
  incomplete on its first run, which is the argument for writing the mechanical
  check before believing the change is done.

## Controls added

| Control | Catches |
|---|---|
| `lib/plan/supersede.test.ts` (13 tests) | The stamp itself, and the regression as the founder's data actually looked |
| `lib/plan/supersedeCoverage.test.ts` (8 tests) | A NEW unfiltered week-keyed read. Walks the source, fails the build, argued allowlist, falsification-tested |
| `lib/planArchiveGuard.test.ts` (+4 tests) | Archive and stamp drifting apart, in either direction |
| `lib/ops/planWeekCollision.ts` (6 tests) | A row already wrong in production. Runs daily inside the plan audit, records `plan_week_collision` |

## New failure class

**"Hazard solved for one transition, named but not solved for its twin."** An ADR
identifies a structural hazard, solves it for the case in front of it, documents
the sibling case in the same file, and the solution is never carried across. The
tell: a lifecycle diagram or state list where one arrow is defended in prose and
an adjacent one is not. Added to the `zona-debug` catalogue.
