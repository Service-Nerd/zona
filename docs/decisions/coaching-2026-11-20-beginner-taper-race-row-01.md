# Coaching Board — `BEGINNER-TAPER-RACE-ROW-01`, 2026-11-20

**Verdict: CORRECT WITH AMENDMENT — open the existing `beginner_goal_pace_blocks` row to the taper. Opening the
sharpener to beginners is INCORRECT (it is reps, and §110b's binding condition is blocks, not repeats); a new row is
unnecessary.**

**Trigger:** hard on build (`sessionCatalogueData.ts` `phase_eligibility`, a taper dose in `generationConfig.ts`).
Records only today: nothing built, no doctrine edited.
**Proposed change (the item's question):** HM/marathon beginners on a time target have no taper race-specific row that
fits their level, so they reach the intermediate-minimum `goal_pace_sharpener` through the derived exception. Choose: a
new beginner taper row, or open the sharpener, or open `beginner_goal_pace_blocks`, to beginners in the taper.

## Analysis — the measurement the 2026-11-12 sitting asked for
The 11-12 sitting filed this under 🅑 *"needs a corpus measurement first: how many beginner tapers reach the
sharpener"*. Evidence: `scripts/board-evidence-beginner-taper-race-row-01.ts` (read-only; full `cohortGrid` plus
`slowGoalGrid` at `slowGoalDates()`; level = `fitness_intensity_level ?? fitness_level`; taper-phase sessions by
`catalogue_id`).

| beginner-intensity cohort (time target) | plans | taper race-specific row | plans reaching `goal_pace_sharpener` |
|---|---|---|---|
| cohort HM, goal live (unbenchmarked) | 864 | sharpener ×792, tempo_continuous ×792, progressive_tempo ×72 | **792 of 864** |
| cohort MAR, goal live (unbenchmarked) | 576 | sharpener ×576, tempo_continuous ×504, progressive_tempo ×504 | **576 of 576** |
| slow grid HM, goal live (benchmarked, inside 5%) | 30 | sharpener ×30, tempo_continuous ×30 | **30 of 30** |
| slow grid MAR, goal live | 20 | sharpener ×20, tempo_continuous ×20 | **20 of 20** |
| any HM/MAR beginner, goal **withheld** | 864 / 576 / 90 / 60 | tempo / progressive only | **0** (§120 Am. 2: withheld taper selects as finish-goal) |
| 5K / 10K beginner, goal live | 864 / 864 | `beginner_goal_pace_reps` ×720 each | **0** (the 2026-10-23 fix holds) |

🔑 **So the derived exception is not an edge case: it is the taper of essentially every HM/marathon beginner whose goal
pace is live** — 1,418 of 1,490 such plans across both grids. The item filed it as a gap; measured, it is the norm for
that cohort.

**The three options against the catalogue as it stands (read, `sessionCatalogueData.ts`):**
- `goal_pace_sharpener` — **1000 m reps at goal pace, 90 s jog recovery**, `fitness_level_min: 'intermediate'`, all distances.
- `beginner_goal_pace_blocks` — **7-minute blocks at goal pace with 3 minutes of easy running**, HM/MARATHON,
  `fitness_level_min`/`max` = beginner, phases **build, peak** only. §110b rung 6.
- `beginner_goal_pace_reps` — 2-minute reps, 5K/10K beginner, build/peak/**taper** (4/6/4 reps, taper = build dose).

**Reach of opening the blocks row to the taper (reasoned from code, not run):** `fitness_level_max: 'beginner'` keeps
it out of every non-beginner pool, and the taper's direct pick (`ruleEngine.ts` ~3856–3878) filters to rows that fit
the level and prefers the narrowest `distance_eligibility`, so it would replace the sharpener **only** in the 1,418
plans above. ⚠️ Not measured: `verify:parity`, `measure:fitness`, `cohort:shape` — conditions on the build.

**What the evidence cannot show:** whether a beginner completes goal-pace work in the taper at all (no completion data);
the goal pace itself is unbounded for unbenchmarked runners, which is `GOALPACE-UNBENCHMARKED-MARATHON-01`, not ruled
here.

## 🔍 Conflict scan
**§110b** — the binding one: rung 6 is `beginner_goal_pace_blocks`, and **Willy's condition of approval: *"BLOCKS, NOT
REPEATS … reps invite a beginner to race the recovery"***. Opening the sharpener (reps) to HM/MAR beginners
**contradicts it** · **§110b's measured warning** *"a row written for a cohort must be scoped to it —
`fitness_level_max`"* (the blocks row already is) · **§36** (taper variety: odd taper weeks prefer race-specific work;
the blocks row keeps that alternation, a fallback to tempo would break it — the 2026-10-23 measurement, 6 + 6 probe
cases, 295 sweep hits) · **§110 Am. 2** (rungs 4 and 6 granted on a time target) · **§120 Am. 2** (withheld plans are
unaffected: 0 sharpeners) · **§22** (`INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO`) · **2026-10-23 GOALPACE-5K-01 ruling** —
the 5K/10K precedent: the beginner row *"replaces the sharpener for beginners"*, taper dose = build dose. No
contradiction with the ruling below.

## Seats
🩹 **Willy:** *"I set the condition, so I'll read it out: blocks, not repeats. The sharpener is thousand-metre reps with
a ninety-second jog, and we are handing it to a first-time marathoner in their taper today because the catalogue had
no other answer. The row I approved already exists. Let it into the taper at a dose no bigger than build."*

🎯 **McMillan:** *"A taper's last goal-pace session is a rehearsal, not a stimulus. Seven minutes at goal pace inside an
easy run is exactly the rehearsal a first-timer needs. Don't write a new row to say what this one says."*

📊 **Seiler:** *"Session count doesn't move — one race-specific session replaces another. No objection."*

⚕️ **Sims:** *"No objection. Smaller, continuous, easy-recovery work in the taper is the right direction for this
cohort."*

🏃 **Hutchinson (chair):** *"The measurement turned a gap into the norm: fourteen hundred plans. One option is forbidden
by our own ruling, one duplicates a row we already ratified, and one extends that row by one phase. That is not a close
call. The 5K/10K row is the precedent for the dose."*

## ⚡ Recorded disagreement
None.

## ⚖️ Ruling — CORRECT WITH AMENDMENT
1. **`beginner_goal_pace_blocks` becomes taper-eligible** (HM/MARATHON, beginner only, unchanged otherwise). It
   replaces `goal_pace_sharpener` in the beginner HM/MAR taper; the derived exception then has no live population at
   any distance.
2. **Opening `goal_pace_sharpener` to beginners is INCORRECT** — it violates §110b's blocks-not-repeats condition.
   **A new beginner taper row is unnecessary.**
3. **Dose:** the taper session carries **no more goal-pace minutes than the build dose** for the same row, mirroring
   `beginner_goal_pace_reps` (build 8 · peak 12 · taper 8).
4. **Conditions on the build:** `verify:parity` must show changes confined to beginner HM/MAR time-target plans with a
   live goal (≈1,418 on these grids); `measure:fitness` and `cohort:shape` reported (McMillan's standing condition);
   withheld plans unchanged (0 today).
5. **Not ruled:** whether an unbenchmarked beginner's goal pace is fit to rehearse at all — `GOALPACE-UNBENCHMARKED-
   MARATHON-01`. If that item withholds goal pace for them, this row simply stops being selected (as for withheld plans
   today).

## 📦 Required artifacts (land with the build, one commit)
| | |
|---|---|
| **Principle** | **§110b amendment** (rung 6 reaches the taper) + **§36** note that the beginner HM/MAR taper's race-specific slot is rung 6 |
| **Numeric** | a **taper** dose cell for `beginner_goal_pace_blocks`, equal to its build dose — the build locates the band that sizes the row today and adds the taper key there |
| **Invariant** | `INV-PLAN-CATALOGUE-ELIGIBLE`'s derived exception must find **no** beginner HM/MAR taper on `goal_pace_sharpener`; falsified by removing `'taper'` from the row's `phase_eligibility` (the 1,418 come back) |

## ↗️ SLT escalation
None. `beginner_goal_pace_blocks` is already `is_free_tier: true`; no tier change.

## What this does not prove
That beginners run the taper session well (no completion data). The reach figure (1,418) is the sharpener population on
two grids, not a parity result; the build's parity run is the proof that nothing else moves.
