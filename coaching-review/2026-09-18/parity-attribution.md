# Parity attribution — every plan change on 2026-09-18

`npm run verify:parity 2dcfa44` (last commit before the day's work) reported
**2,007 of 5,940 cases CHANGED**. That headline is not a finding on its own —
`verify-parity.ts` prints only 25 samples and then `...and 1982 more`, and all
25 happened to be refusal strings. This file classifies **all 2,007**, by
reproducing the parity grid on both sides and comparing plan hashes, refusal
status, and long-run-note presence per case.

| Cause | Cases | Detail |
|---|---:|---|
| Refusal MESSAGE text (`REFUSAL-COPY-02`) | **1,566** | Copy only. No plan is generated on either side, so nothing prescribed changed. |
| `OK -> REFUSED` (§111 base volume) | **202** | **Every one at 15 km/week.** Board-ruled and shipped today as `MARATHON-VOLUME-GATE-01`. |
| Long-run shortfall NOTE (§80 Am.1 / `LR-SHORTFALL-CAUSE-01`) | **237** | 169 text-only, 68 gained/lost. |
| Volume curve (§111 floor moved onto the ramp) | **2** | Bisected to commit `8670423`. |
| **TOTAL** | **2,007** | **Unexplained: 0** |

## The three things worth stating plainly

**1. `REFUSED -> OK` is ZERO.** Nobody who was refused yesterday now gets a plan.
Every status change runs the other way, and all 202 of them are the §111
base-volume gate firing at 15 km/week — a runner on 15 km/week asking for a
marathon or a 50K. That is the gate doing its job, not a regression.

**2. The 32 plans that LOST the shortfall note are not under-warned.** They are
finish-goal, low-volume HM/marathon beginners including knee and shin histories
— visibly the charity cohort, which is why this needed checking rather than
assuming. `LONG_RUN_SHORTFALL_MATERIAL_PCT` is **5%**, and the note those plans
used to carry read *"tops out at 116 minutes… we'd normally want it nearer 118"*
— a **2-minute, 1.7% shortfall**. That is verbatim the case §80 Am.1's own code
comment says the materiality tolerance was added to silence. They were being
over-warned by a note that fired on a 2-minute gap and blamed the wrong lever.

**3. No session, pace, structure or weekly volume changed anywhere except the
2 §111 ramp cases.** 237 of the 239 plan diffs are a single `meta` note string.

## What this does NOT prove

- The parity grid pins `plan_start`, so it contains **no pre-plan-runway cases**
  and cannot see a foundation-block change. Nothing today touched
  `foundationBlock.ts`, but this run is not evidence of that.
- It varies neither `foundation_decision`, `day_budgets`, `max_weekday_mins` nor
  `recent_quality_training`. The property sweep reaches those; parity does not.
- `verify-parity.ts` prints 25 samples. **Reading its output is not the same as
  classifying its result** — the samples were 100% refusal strings while 239
  plans had in fact changed. This file exists because of that gap.

## Method

Reproduced the parity grid (`scripts/verify-parity.ts` lines 61-190) on the
working tree and in a `2dcfa44` worktree, recording per case: refusal status,
plan hash with wall-clock meta stripped, and `meta.long_run_shortfall_note`
presence. Determinism was confirmed on both sides first (two runs, identical
output), so a hash difference is a code difference and not engine noise. The
2-case volume-curve change was attributed by bisecting all 15 of the day's
commits that touch `lib/plan/`.
