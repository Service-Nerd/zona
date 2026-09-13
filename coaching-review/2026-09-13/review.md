# Coaching review round — 2026-09-13

First run of the auto-triggered loop (COACHING-REVIEW-AUTO-01), executed by hand to
exercise it end to end. Both sets: 4 canonical + 11 charity.

## Validation summary

Every case generated with **0 error violations, or refused by design.** No plan breaks
its own constitution. Warn counts (the board's to weigh): canonical 10K 2, canonical HM
5, canonical marathon 3; charity M1 2 / M3 2 / T3 3, others 0–1; M4 refused by design.

## Charity half

Boarded the same day — **CORRECT, ship as-is.** Full record:
`docs/decisions/coaching-board-2026-09-13-charity-cohort.md`. Watch-items filed:
`CHARITY-CAP-ABSFLOOR-01`, `CHARITY-M4-FRAMING-01`.

## Canonical half — two findings

### 1. `LARGEST-SESSIONS-SPACED` ×5 (Anna, HM 1:55, blocks Mon/Wed/Fri) — NO ACTION
Her only free days are Tue/Thu/Sat/Sun, so the long run (Sun) and the second-biggest
session (Sat) land back-to-back for 5 weeks. **Ruling: correct.** The warn is honest
("likely forced by available days"), it is genuinely forced by the runner's own blocked
days, and moving a big session to a weekday would break the 75-min weekday cap. McMillan:
real amateurs run Sat+Sun. Willy: fine for a healthy intermediate — and it does **not**
fire on the injured/masters cases in this round. No change.

### 2. `PEAK-SPECIFICITY` = 0/2 (Mike, marathon 4:00, downgraded to maintenance) — BOARD-GATED, FILED
The peak carries two quality sessions and **neither is race-specific** — a runner who
declared a 4:00 goal gets zero goal-pace rehearsal in the weeks closest to the race. The
invariant's own comment names 0% as "the state it was written to catch," it is **not** in
the sweep baseline, and — unlike sibling invariants (`invariants.ts:3541/4145`) — it does
**not** exempt `volume_profile === 'maintenance'`. So the question is genuine and
unresolved:

- **Reading A — exempt it.** A maintenance downgrade *means* the plan has stopped chasing
  the time (the runner acknowledged the prep/days warning), so 0% goal-pace work is
  correct and the invariant is crying wolf on a correct plan → add the maintenance
  exemption its siblings already have.
- **Reading B — fix the plan.** The runner still declared 4:00 and chose to proceed;
  zero rehearsal of goal pace under-serves them → a maintenance marathon peak should carry
  ≥1 race-specific session.

Both are defensible; they change either an invariant's exemption or engine prescription,
so this needs a Coaching Board ruling, not a call here. **Filed as `PEAK-SPEC-MAINT-01`.**

**UPDATE — RULED + FIXED same day (CB-SPEC-02).** Investigation showed *both* readings
were wrong: Mike's peak **does** carry a Marathon-pace long run (`mp_long_run`,
`race_specific`) — the invariant only counted `type:'quality'` sessions and so missed the
marathon's canonical specific vehicle, reporting a false 0%. Board ruled **CORRECT WITH
AMENDMENT**: for HM/MARATHON a race-specific long run now counts toward peak specificity
(type unchanged; §1/§52 untouched). No prescription change. Record:
`docs/decisions/coaching-board-2026-09-13-peak-spec-maint.md`.

## What running the loop proved
It caught a stale canonical case on the way in (Case 04's days-minimum ack) and surfaced a
real, untracked coaching question (`PEAK-SPEC-MAINT-01`) that the green test suite and the
sweep could not see — exactly the "is it *good*, not just *valid*" gap the loop exists for.
