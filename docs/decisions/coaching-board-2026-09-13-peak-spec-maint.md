# Coaching Board — PEAK-SPEC-MAINT-01 (CB-SPEC-02), 2026-09-13

**Trigger:** `docs/canonical/CoachingPrinciples.md` §93 + `lib/plan/invariants.ts` — hard, convened.
**Ruling: CORRECT WITH AMENDMENT.** For HM/MARATHON, `INV-PLAN-PEAK-SPECIFICITY` counts a
`race_specific`-category **long run** as peak specificity. No prescription change — a
measurement correction that ends a false-0% warn.

Surfaced by the first auto-triggered coaching-review round
(`coaching-review/2026-09-13/review.md`).

---

## The question

Canonical Case 04 (Mike — 4:00 marathon, 4 days, 38 km/wk, returning + hip, 13 weeks,
downgraded to `maintenance`) reported `INV-PLAN-PEAK-SPECIFICITY` **0%** — "a runner
chasing a goal pace gets no rehearsal of it." Filed as PEAK-SPEC-MAINT-01 with two
readings: (A) exempt maintenance plans, or (B) force a race-specific session.

## Ground truth (why both filed readings were wrong)

Investigation before the board:

- Mike's peak **does** carry a **Marathon-pace long run** (`mp_long_run`, category
  `race_specific`) in week 10. He rehearses goal pace. The "0% / no rehearsal" message
  was **factually false**.
- The invariant counted specificity only among `type:'quality'` sessions. A marathon's
  canonical specific vehicle is the MP long run (role `long_run`, type easy) — invisible
  to it.
- A well-resourced 3:30 build (55 km, 5 days, 20 wk) — **also `maintenance`-classified** —
  passed, because it additionally got `mp_blocks` as a quality session. So maintenance is
  **not** the cause; resourcing is. Reading (A) is wrong.
- §93 itself already documents the intended marathon mechanism: the (decorative, unread)
  `peak_includes_mp_long_runs` flag. The intent was written; no code exercised it — the
  §1/CD-19 pattern once more.

So neither exempting maintenance (A) nor forcing an extra MP session (B) is right: the
plan was correct; the **check** was blind to the long run.

## Board

- **Hutchinson (chair):** the message is false — he rehearses MP. For a marathon the MP
  long run *is* the specific session. Fix the measurement, not the plan.
- **McMillan:** for a returning, hip-history 4:00 hopeful, one MP long run + threshold in a
  two-week peak is the right dose. Don't add an MP quality session.
- **Willy:** agreed — adding MP intensity on top for this runner is a load risk. No
  prescription change.
- **Seiler (dissent, preserved):** the long run is aerobic volume in Zonna's frame (typed
  easy for §1/§52); don't relabel it a quality session. **Resolved** by counting it toward
  §93 *specificity only*, scoped to HM/MARATHON, without changing its type — §1/§52 untouched.
- **Sims:** no objection; scoping to the long run's existing role avoids adding intensity
  to masters/returning tissue.

## Amendment

For HM/MARATHON, a `race_specific`-category long run counts in the peak-specificity ratio
(numerator + denominator). Type unchanged. A plain Zone-2 long run does not count.

## Artifacts

1. **Principle** — §93 amendment CB-SPEC-02 (`CoachingPrinciples.md`).
2. **Numeric** — none. `SPECIFICITY_BY_PHASE` is unchanged; the ruling is a measurement
   correction, so no new constant. Stated explicitly per the board's three-artifact rule.
3. **Invariant** — `INV-PLAN-PEAK-SPECIFICITY` updated to count race-specific long runs;
   registry row updated in `plan-invariants.md`.

## Measurement

- Case 04 PEAK-SPECIFICITY: **fires → cleared.**
- Sweep: **no new violations above baseline**; PEAK-SPECIFICITY still fires on 2.4%
  (390/16,038) — not dead, still catches genuine 0% peaks (e.g. all-VO2max 10K).
- Plans byte-identical (invariants.ts does not feed plan construction) — "no prescription
  change" confirmed. `verify` green (1643 tests), typecheck + hooks-lint clean.
