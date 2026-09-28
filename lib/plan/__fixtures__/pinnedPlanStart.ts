// TEST-CLOCK-PREPTIME-01 (2026-09-28) — the pinned plan start every engine test
// generates against.
//
// ── WHAT HAPPENED ────────────────────────────────────────────────────────────
// Four test files called `generateRulePlan(input, tier)` with an ABSOLUTE
// `race_date` and no `planStart`, so the engine fell back to
// `formatDate(nextMonday())` — the WALL CLOCK. The race date stood still and the
// plan start walked toward it, one week every week, until §44's prep-time gate
// refused to generate at all:
//
//   lib/sessionColourReach.test.ts          marathon  → PrepTimeError('block')
//   lib/coaching/zoneSheetMatchesHeader.ts  10K       → PrepTimeError('warn_unacknowledged')
//   lib/plan/hardPrefNote.test.ts           10K       → PrepTimeError('warn_unacknowledged')
//   lib/plan/inputEffect.test.ts            10K       → PrepTimeError('warn_unacknowledged')
//
// Measured on 2026-09-28: 9 tests across those 4 files, RED on a clean tree.
// `PREP_TIME_THRESHOLDS.MARATHON.block` is 10 weeks; the marathon fixture had 9.
//
// 🔴 THE COST IS NOT THE RED — IT IS WHAT THE RED HID. Every one of those
// assertions stopped being TESTED and started being UNPROVEN, and they are not
// small: `--s-long` is reachable at all (PLAN-LONGRUN-COLOUR-01), the zone sheet
// teaches the zone the header showed (ZONE-SHEET-01, a 837-session defect), the
// §96 honesty note exists, and every `GeneratorInput` field still DOES something
// (INPUT-EFFECT-01). A generation that refuses before reaching the subject looks
// exactly like a generation that reached it and disagreed.
//
// This is the class `cohortGrid.ts` already names in its own header —
// SWEEP-VACUOUS-01, "a time-dependent grid stopped generating and reported a
// clean bill of health for months" — and it had been solved in exactly one place.
// Four files never adopted it.
//
// ── WHY THIS DATE ────────────────────────────────────────────────────────────
// 2026-09-14, the Monday on or after every one of those four files was authored
// (git: 09-08, 09-09, 09-12, 09-12). That is precisely what `nextMonday()`
// returned when each was written and passing, so pinning it REPRODUCES the
// original prep window rather than inventing a new one — the fixtures generate
// the same plans they were written against, forever.
//
// ⚠️ NOT `COHORT_PLAN_START` (2026-04-27), deliberately. Reusing it would put
// these races 33 weeks out instead of 12–13, which is a different plan: past
// §44's warn bound, into the long-runway and foundation paths, with a different
// length and shape. That would leave the tests green while quietly changing the
// thing under test — the same "fixed it by changing the subject" trap
// `inputEffect.test.ts`'s own FIXTURE TRAP section warns about.
//
// ── HOW TO USE IT ────────────────────────────────────────────────────────────
//   generateRulePlan(input, 'paid', PINNED_PLAN_START)
//                                   ^ 3rd positional arg
//
// `planStart` and `todayOverride` are DECLARED TEST SEAMS on `generateRulePlan`
// ("Never passed by production callers"). Passing one is the supported way to be
// clock-independent; there is no need to mock a clock.
//
// ⚠️ IF YOU WRITE A NEW ENGINE TEST WITH AN ABSOLUTE `race_date`, PASS THIS.
// A relative race date (`today + N weeks`) is the other valid answer, but it is
// NOT interchangeable: it keeps the window fixed while changing WHICH DATES the
// plan lands on every run, so day-of-week-sensitive behaviour (§26 race eve,
// weekend carriers) drifts. Pin both, or pin neither and assert nothing about
// the calendar.

/** The Monday these fixtures were written against. See the header for why. */
export const PINNED_PLAN_START = '2026-09-14'
