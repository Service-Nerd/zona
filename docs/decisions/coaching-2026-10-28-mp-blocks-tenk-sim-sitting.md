# Coaching Board: two rows that do not repeat (2026-10-28, MP-BLOCKS-ONE-BLOCK-01 + TENK-SIM-ONE-REP-01)

**Founder:** "Take these to the board." Both were found building S9-ONE-REP-01 and are registered debt in
`INV-PLAN-REPEATS-REPEAT`.

## Evidence (measured 2026-10-28 at `6d6e1c51`)

Population: 4,000 cohort-grid inputs (stride 7919) plus 1,200 slow-runner clones of 10K and marathon inputs, built the
way the property sweep builds its `@slow-goal` set (`SLOW_BENCHMARKS` x `GOAL_GAPS`). Options were prototyped **in memory
only** (catalogue row and dose config mutated inside the script, no file touched; `scripts/.tmp/mptenk.ts`). Every plan
is validated under the catalogue that generated it. ⚠️ The first run validated baseline plans under a mutated row and
reported 234 phantom error violations; caught and re-run.

**`mp_blocks` ("Marathon-pace blocks": reps x 4 km at goal pace / 3 min jog, marathon peak only).** One block for
**every session measured: 234 of 234 cohort, 98 of 98 slow.** Not a slow-runner problem: 4 km at any marathon pace
slower than 3:45 /km is past the threshold band's 15-minute minimum, and the target rounds to one. So the session is one
continuous 4 km at marathon pace, followed by a 3-minute jog that leads to the cool-down ("Enough to reset, not enough to
forget the pace"). **Live: 6 plans** (a1a1b638, 3cc7c3a9, c848fd4c, 4b037d2c, 3a83ea55, a91d8fde); five of them are in
the 11-plan dry-run batch.

| Option | What changes | Measured |
|---|---|---|
| M1: a marathon-pace work band (20–50 min) | 132 of 234 cohort sessions → 2 x 4 km (8 km at MP) | slow unchanged (still one); 57 cohort plans change; warns only |
| M2: call it what it is: "Marathon-pace run", one 4 km at MP, no trailing jog, sizing unchanged | every session 47 → 44 min, MP work unchanged | 108 cohort / 49 slow plans change (easy runs absorb 3 min); warns only, net −1 |
| M3: 2 km blocks | cohort 2 x 2 km (same 4 km + a jog); **slow 1 x 2 km (half their MP, still one block)** | 108 cohort / 49 slow plans change |

**`tenk_race_simulation` ("10K-pace race simulation": reps x 2 km at goal pace / 90 s, 10K peak).** Cohort: 2 reps
always (31). Slow: **13 of 20 sessions are one rep** (~16–18 min at goal pace, 35-minute session); the sweep counted 19.
**Live: 1 plan (1ee07aed), at 2 reps.** It was created on 11 Sep (CAT-10K-RACE-SPECIFIC-01) because 100% of 10K
time-goal plans placed `tenk_pace_intervals` twice.

| Option | Measured |
|---|---|
| T1: sibling `tenk_pace_intervals` | 0 cohort, 15 slow sessions change; **+13 `INV-PLAN-RACE-SPECIFIC-VARIETY` warns: the same race-specific session twice, the defect this row was created to fix** |
| T2: a two-rep floor (2 x 2 km) | slow 13 → 0 one-rep, 20 sessions at 2 reps, sessions 35 → 51–55 min, 32–36 min at goal pace. ⚠️ **Via the dose band it cannot be scoped:** any minimum that gives a slow runner a second rep gives a fast runner a third (19 cohort sessions 2 → 3). A slow-only build needs a rep-count floor, not a band |
| T0: leave it | one 2 km rep labelled a race simulation, with a jog after it |

## Conflict scan

- **§19 Am.2 (this morning):** a rep-scaled row below two reps is not delivered as that row. M2 takes `mp_blocks` out
  of "rep-scaled" honestly instead of exempting it; T2 meets it directly.
- **§85 / `THRESHOLD_WORK_*` (15–30):** race-specific rows are sized on the threshold band. T2's 32–36 minutes at goal
  pace is over 30. The question is whether a minutes band derived for threshold is the right yardstick for race-pace
  work at 10K, where specificity is a share of the race.
- **CAT-10K-RACE-SPECIFIC-01 (11 Sep):** the race simulation exists so a 10K peak sees two different race-specific
  sessions. T1 undoes that for slow runners: **contradicts it.**
- **§25 / `INV-PLAN-RACE-PACE-WEEK-CONCENTRATION`:** a week with an MP long run may not also carry MP blocks. M1 raises
  MP load in the weeks that carry it; M2 does not change it.
- **§22 / §120 Am.2:** goal pace is priced where reachable; unchanged by all options.
- **§1:** session counts unchanged by every option.

## The seats

🏃 **Hutchinson (chair).** The marathon row was never broken. It is a perfectly standard session, four kilometres at
marathon pace, wearing the name of a different one. Fix the name and the jog to nowhere, and leave the dose alone until
someone measures what a bigger one does. For the 10K row the sibling is out: it brings back the exact repetition the
row was built to remove. The real question is what a race-specific session is measured in, and for a 10K it is a share
of the race. Two 2 km reps is 40% of the distance at race pace, less than the 60% this row gives an average runner.

📊 **Seiler.** On the marathon row I said this morning it should repeat to earn the slot. Measured, I was asking for M1,
and M1 doubles marathon-pace work for most runners with no evidence it builds them better. I withdraw the demand to
repeat; I keep the dose question open. On the 10K, two reps at race pace with a short jog is the session as designed;
the minutes band is a threshold instrument.

🎯 **McMillan.** M2 is what I said this morning: the session is right and the name is wrong. Marathon-pace runs of 4 to
8 km are a staple. Not M3: halving a slow runner's marathon-pace work to make the word "blocks" true is the name driving
the coaching. On the 10K, a slow runner deserves the same race rehearsal as a fast one, and that is reps, not one.

🩹 **Willy.** M2 is less load, not more: support. T2 is my concern: 32 to 36 minutes at race pace, in sessions of nearly
an hour, for the slowest 10K runners in the product, some of them over 60. Race pace for them is gentle per minute, which
is the argument for it, but the session is a third longer than the one they get today. **Condition:** a rep-count floor
scoped so only one-rep sessions move, capped at the race share the row was designed for, and `measure:fitness` plus the
10K beginner and masters cohorts read at build. If those show harm I will ask the chair to reopen it.

⚕️ **Sims.** Support both. On T2: older women in this cohort are the ones most likely to be handed a one-rep
"simulation" that rehearses nothing; a second rep with a short jog is the rehearsal. Agree with Willy's condition.

💪 **Blagrove.** No objection from this seat.

## Recorded disagreements

- **Seiler: marathon-pace dose.** He holds that MP work away from the long run may be under-dosed at 4 km for runners
  with the volume for more. Not ruled: M1 doubles it with no fitness evidence. Filed `MP-WORK-DOSE-01`.
- **Willy vs McMillan on T2's length.** Willy accepts T2 only under his condition; McMillan would accept it unconditioned.

## Ruling

**MP-BLOCKS-ONE-BLOCK-01:**
- **M2: CORRECT WITH AMENDMENT.** The row becomes "Marathon-pace run": one continuous 4 km at marathon pace, no trailing
  jog. Its marathon-pace work is unchanged. It is no longer a rep-scaled row, so `INV-PLAN-REPEATS-REPEAT` covers it by
  construction and the debt entry is removed. The `catalogue_id` stays `mp_blocks` (stamped on live plans, never shown).
- **M1: INSUFFICIENT EVIDENCE** (Seiler's dose question, `MP-WORK-DOSE-01`, needs `measure:fitness` on a prototype).
- **M3: INCORRECT** (halves slow runners' marathon-pace work and still leaves them one block).
- **Amendment:** the build re-runs the 11 live dry runs before any is applied, because five of them carry this row.

**TENK-SIM-ONE-REP-01:**
- **T1: INCORRECT** (re-creates the 11 Sep repetition defect, +13 variety warns measured).
- **T2: CORRECT WITH AMENDMENT (Willy's condition, binding).** A race-specific rep row sized below `REP_ROW_MIN_REPS`
  is given `REP_ROW_MIN_REPS` reps, **only while** that many reps stay within `RACE_SPECIFIC_MAX_RACE_SHARE` of the race
  distance (0.6, the share this row was designed to give: ~6 km of 10 km). Scoped as a rep-count floor, never a band,
  so no session that already has two reps changes. Measured on the prototype: the slow sessions become 2 x 2 km, 4 km of
  10 at race pace (40%). **At build:** `measure:fitness`, and the 10K beginner and masters cohorts read; any harm reopens it.
- **T0:** not chosen.

## Required artifacts (at build)

1. **Principle:** §19 Amendment 2 gains two paragraphs (the continuous marathon-pace run; the race-specific rep floor).
2. **Numeric:** `RACE_SPECIFIC_MAX_RACE_SHARE = 0.6` in `GENERATION_CONFIG`; `REP_ROW_MIN_REPS` reused.
3. **Check:** `INV-PLAN-REPEATS-REPEAT` with both debt entries removed. A second arm holding the race-share cap on the floor's output.
   ⚠️ Its scope is measured at build first: a plan-wide "no race-specific session over 60% of the race" was not measured
   here and may already fire on existing sessions (the cohort's 3 x 2 km is exactly 60%).

## SLT escalation

None.
