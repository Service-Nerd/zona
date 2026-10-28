# Coaching Board: a long run shorter than the runner already runs; an Achilles runner's unannounced jump (2026-10-28)

**Founder:** "3 yes", answering "take graceemilyhill's long run and emilyjcgibbs's jump to the Coaching Board?"
Items: `LONG-RUN-BELOW-LONGEST-01`, `INJURY-PEAK-JUMP-01`. Both found reviewing the 28 Oct manual digest.

## Evidence (measured 2026-10-28, today's engine, marathon only)

Population: the marathon inputs among 6,000 cohort-grid and 3,000 targeted-grid inputs (stride 7919), each run healthy,
with Achilles, and with knee + hip + back + shin splints. Scripts in `scripts/.tmp/bm2.ts`, `bm3.ts` (scratch, not
committed). No file was changed to measure.

### 1. The peak long run is shorter than the runner's stated longest recent run

| cohort | built | peak LR shorter than stated longest | of those at the 210-min cap | median gap |
|---|---|---|---|---|
| healthy | 2,243 | **308 (13.7%)** | 133 | 2.0 km |
| Achilles | 2,243 | 308 (13.7%) | 131 | 2.0 km |
| knee + hip + back + shin | 2,259 | **660 (29.2%)** | **0** | **9.0 km** |

A plan at the 210-minute cap is conforming by §24's amendment (the time cap governs; Willy, 2026-09-20). The rest are
not explained by any principle. graceemilyhill (c848fd4c: 30 km/week, longest recent run 21 km, four injuries, London
4:45) holds 24–30 km/week for 20 weeks and her longest run is **13.5 km**: the injury ceiling holds the week, and the long
run is capped as a share of it. Her plan's note says *"the long run can only grow so much week to week, and it ran out
of weeks before it got there"*, which is not the cause. No invariant compares the peak long run with
`longest_recent_run_km`.

### 2. A large week-on-week rise, and whether the runner is told

emilyjcgibbs (d4c4db1e, marathon 5:00, Achilles): weeks 15 → 16 go 38 → 47 km (+24%). Today's engine produces the same
jump. **Settled ground:** §90 Amendment 2 (INJURY-DELIVERED-COVERAGE-01, 2026-09-25) kept the PRODUCER's 5%/week cap on
knee and shin (`INJURY_WEEKLY_INCREASE_CAP_PCT`) and widened only the CHECKER to the load-bearing injuries
(`DELIVERED_CAP_INJURIES`, Achilles included), as a warn, recording 43.8% as the top of the acceptable band.

| cohort | warned by `INV-PLAN-DELIVERED-RAMP` or `INV-PLAN-INJURY-CAP-DELIVERED` | of those, **no load note** |
|---|---|---|
| healthy | 765 (34.1%) | 401 (52%) |
| Achilles | 998 (44.5%) | **615 (62%)** |
| knee | 457 (20.2%) | **387 (85%)** |

So most runners whose plan breaches the ramp check are not told. `load_residual_note` competes with the other plan
notes for one slot (a more specific note displaces it, `ruleEngine.ts` peakShortfall comment), which is a likely cause
and is not yet measured.

## Conflict scan

- **§106** (a plan never peaks below where the runner already is): the weekly-volume rule. Item 1 is its long-run
  analogue and §106 does not cover it. §106's own condition (Willy): *"a floor on the ceiling, never a scaled target"*;
  self-reported numbers must not become permission to add load.
- **§24 and its amendment**: the marathon long-run floor yields to `LONG_RUN_CAP_MINUTES`; a plan held by the cap is
  conforming. 133 of the 308 healthy cases.
- **§9 / §52** (long run share of the week, 60%): the share cap is what binds the injured cohort's long run once the
  week is held.
- **§12 / §90 / §90 Am.2**: the injury producer cap is knee/shin, the checker is load-bearing. Item 2 does not reopen
  that split.
- **§34** (declared residuals): a residual the engine accepts is stated, never absorbed silently. 52–85% of warned
  plans state nothing.
- **§40c**: a suppressed target is stated. The wrong cause in graceemilyhill's note is a §40c defect.

## The seats

🏃 **Hutchinson (chair).** Two different questions. The first is a hole in the constitution: §106 says the week may not
fall below what the runner does, and nothing says the same of the long run, which for a marathoner is the one session
that matters most. The second is not a coaching question at all: the board ruled in September that this residual is
accepted and warned, and §34 says an accepted residual is stated. Most of these runners are not being told. That is a
defect against existing doctrine.

📊 **Seiler.** Neither touches distribution. On the first: a long run that falls nine kilometres below what she already
does is not a polarisation choice, it is losing the session.

🎯 **McMillan.** Grace already runs 21. Telling her to top out at 13.5 for a marathon is the plan detraining the one
thing she has. A coach would hold her long run where it is and protect the rest of the week. But I want to see what
holding it costs before I say yes: if the week is pinned at 30, a 21 km long run is 70% of it.

🩹 **Willy.** My condition on §106 stands: stated longest run is self-report, and "longest recent" can be a one-off from
two months ago. I will not accept a floor that lets an unverified number add load to a four-injury runner. What I would
accept: the long run does not FALL below what she already does without that being said, and a prototype measuring the
other option, holding the stated long run and trimming easy volume, against the injury cap and the ramp. On the jump:
I ruled the September split and I stand by it, but the warn only protects her if somebody reads it, and the runner is
the somebody. She should be told.

⚕️ **Sims.** Agree with Willy on both. Four injuries including hip and back, and a 26-year-old woman: if her long run is
being cut, she needs to know why, because she will otherwise go out and run her 21 anyway, outside the plan.

💪 **Blagrove.** No objection from this seat.

## Recorded disagreement

McMillan leans toward holding the stated long run; Willy will not accept that without a prototype showing what it does
to the week share and the injury cap. Settled by the measurement below, not by argument.

## Ruling

**`LONG-RUN-BELOW-LONGEST-01`: INSUFFICIENT EVIDENCE for an engine change; CORRECT for the copy defect.**
- **What would settle it:** a prototype (in memory) for the marathon cohorts above that holds the peak long run at the
  stated longest run where the time cap allows, with easy volume yielding so the week does not grow, measured on
  `INV-PLAN-INJURY-CAP-DELIVERED`, `INV-PLAN-LR-MAX-WEEKLY-PCT`, `measure:fitness`, and how many plans it changes.
  Willy's condition binds: it may not raise any week's volume.
- **Now:** the note that says *"it ran out of weeks"* when the injury ceiling is the cause is a defect fix (the note
  must name the constraint that binds). No board needed; the words are the founder's.

**`INJURY-PEAK-JUMP-01`: CORRECT (defect against §34): a plan that breaches the ramp or injury-cap check must tell the
runner.** The producer split of §90 Am.2 is unchanged. Measure first why 52–85% of warned plans carry no load note
(slot competition is the likely cause), then make the ramp residual reach the runner whenever either check fires.
**Artifacts at build:** §34/§90 cross-reference in the principle text; no new numeric; a check that a plan warned by
either arm carries a load note (falsified by suppressing the note).

## SLT escalation

None.
