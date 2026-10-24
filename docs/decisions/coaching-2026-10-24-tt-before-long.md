# Coaching Board — TT-BEFORE-LONG-01 (2026-10-24)

**Trigger:** soft, qualifies. `lib/plan/ruleEngine.ts → applyRecalibrationTimeTrial` places the §78 benchmark; the
question is whether §7's spacing binds it, which changes what the engine prescribes.
**Proposed change:** the §78 time trial may never sit on the day either side of the long run.

## Re-measured first (2026-10-24)

| | Filed | Measured |
|---|---|---|
| Cause | "the engine's §7 placement does not count the time trial" | **Wrong.** The placement already means to keep them apart: it picks the eligible easy day *furthest from the long run* (`dayGap`, circular, correct). It lands next to the long run only when that is the **only eligible day** |
| The trigger | unknown | Ablated field by field on the live input: a **per-day budget** (`day_budgets: { fri: 90 }`) under a **45-minute weekday cap**, plus a **Saturday long run**. The budget concentrates easy volume on Friday, so at placement Monday and Wednesday are **5.0 km**, under `RECALIBRATION_TIME_TRIAL.min_slot_km` (7). Friday (7.0 / 8.1 km) is the only candidate. Remove the budget and the trial goes to Wednesday; move the long run to Sunday and it is two days clear |
| Today's engine | | Reproduces it exactly (weeks 7 and 11) |
| Grids | | `cohortGrid` + `targetedGrid`: **0 of 8,118** trials adjacent; a Saturday-long-run variant, 0 of 11,104; a hand-built Saturday/cap/blocked-days cohort, 0 of 1,948. **None of them combines a day budget with a Saturday long run**, which is why none could see it |
| Live | 1 plan | **1 of 36** (cate.stacey@icloud.com, London Marathon, `799c49e8`). 4 of 36 have day budgets, 17 a weekday cap, 6 a Saturday long run, 14 recalibration weeks |
| Can it be fixed by time instead of km? | | For this runner, no: a 2:29:56 half implies roughly a 32-minute 5K; with the session's own 10-minute warm-up and a cool-down that is ~50 minutes against a 45-minute Wednesday |

## Conflict scan

| § | Bearing |
|---|---|
| **§7** + **Am.1** (today) | 48 h between any two stressors; Am.1 names the time trial a hard day (`isHardDay`). Adjacency contradicts it as written |
| **§78** | The benchmark is placed on a deload week *"on purpose. Fresh legs make the measurement meaningful."* The trial comes BEFORE the long run here, so the measurement is fine; the cost falls on the long run. §78 also already has the fallback: *"If the slot is too short ... no conversion happens and the week is not listed as a recalibration week — the metadata follows the plan, never the intent."* |
| **§18 / weekday cap / day budgets** | The runner's declared time limits are never exceeded to make room for a session. Not reopened |
| **`preferred_long_run_day`** | The runner chose Saturday. Not overridden by a coaching rule |
| **§52** | The long run is kept every week. Not reopened |
| **ADR-014** | Recalibration application is prompted + confirmed. A skipped benchmark only means no prompt that block |

No section is contradicted by the proposal; one plan contradicts §7 because §78's placement has no §7 filter.

## The board

**🏃 Hutchinson (chair).** The filed premise was that the engine does not count the trial. It does: the code's own
comment says *"keeps the hard effort and the week's longest run apart (§7 spacing intent)"*. What it lacks is a
rule for when the only big-enough day breaks that intent. So the question is narrow: when §78 and §7 cannot both be
met, which yields?

**📊 Seiler.** Not a distribution question. The trial is outside the quality count by design (§78) and stays there.

**🎯 McMillan.** I will say the uncomfortable thing: parkrun on Saturday and the long run on Sunday is the most common
weekend in amateur running, and most people survive it. But that is a runner's choice, not a prescription. The app
should not be the one putting a maximal 5K the day before the week's longest run when the runner has not asked for it.
And the honest alternative already exists in §78: no slot, no benchmark that week, and say nothing that implies one.

**🩹 Willy.** This is the case §7 was written for: a maximal effort, then the longest run on legs that have not
recovered from it, in a marathon block. The deload trims that long run (80 and 121 minutes here), and it is still a
long run. §7 binds. A missed benchmark costs a stale pace; a long run on wrecked legs costs tissue. Those are not the
same order of cost.

**⚕️ Sims.** For a woman in a marathon build on four days a week the recovery window after a maximal effort is the
first thing to protect. I would also not widen the slot by pushing her past her 45 minutes: that limit is the life she
told us about. Skip it.

**💪 Blagrove.** No strength question. Silent.

## Recorded disagreements

McMillan holds that the cost of skipping is real: this runner has two recalibration weeks and both fall in this
shape, so she gets **no** benchmark in the block. He would accept the skip only if that is visible to the runner, not
silent. Willy and Sims would skip regardless. **Settled by:** the skip is the ruling; visibility is routed to the
design and copy owners as a follow-on, because what to tell her is not this board's decision.

## Ruling

**CORRECT WITH AMENDMENT.** §78's placement gains §7's filter: **a time trial may not be placed on a day either side
of the long run** (`dayGap <= 1`). If no eligible day is two or more days clear, the benchmark does not happen that
week and the week is not listed in `recalibration_weeks`, exactly as §78 already does for a slot that is too short.

**Amendments:** (1) the runner's weekday cap and day budgets are never exceeded to make room; (2) the long-run day is
never moved to make room; (3) the gap is the same circular `dayGap` the placement already uses; (4) a runner who
loses every benchmark in a block to this rule is filed as a visibility follow-on, not silently accepted.

## Artifacts

1. **Principle** — §78 Amendment 2: the benchmark obeys §7.
2. **Numeric** — `GENERATION_CONFIG.RECALIBRATION_TIME_TRIAL.min_gap_days_from_long_run = 2`.
3. **Invariant** — `INV-PLAN-TT-LONG-RUN-SPACING`: no `type: 'hard'` session on a day within one of the long run;
   error severity; registered in `plan-invariants.md`; must be woken by a liveness mutation (the corpus has no
   instance, so the grid gains the day-budget + Saturday-long-run cell that does).

## SLT escalation

None.

## Built (2026-10-24)

All three artifacts landed. Falsified: removing the placement filter makes the new invariant stop generation of
weeks 7 and 11 of the live shape; neutering the invariant's comparison turns the forged-plan arm red; disabling the
liveness mutation fails `invariantLiveness.test.ts` naming this invariant. Rebuilding all 27 regenerable live inputs:
one plan changes (`799c49e8`, both benchmarks dropped), zero trials beside a long run. Follow-on filed:
`TT-SKIPPED-VISIBILITY-01`.

## What this does not settle

What the runner is told when her block has no benchmark (copy and design), and whether the existing plan `799c49e8`
is regenerated or patched (remediation, founder's call under the live-plan policy).
