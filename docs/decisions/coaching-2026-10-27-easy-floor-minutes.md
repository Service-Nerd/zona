# Coaching Board submission: should the easy floor be 4 km or a time? (2026-10-27)

**Input:** `S9-EASY-MINUTES-01`; founder: "Take S9-EASY-MINUTES-01 to the coaching board". The 26 Oct RCA sitting ruled
the direction CORRECT and asked for evidence first: *"Prototype '≥ 4 km or ≥ 30 min', measure weekly volume,
`measure:fitness`, §52b and §82 interplay, then a sitting."* This is that evidence.

**Method.** A throwaway prototype at `9855daee`: `sessionFloorsFor`'s easy floor became `min(4 km, N min at the
runner's easy pace)`, so every one of the floor's consumers (construction, §82's weekday floor protection, §90's trim
floor, the checker) moved together. Measured on three grids at N = 30 and N = 35, against the unchanged engine:
the slow-goal grid (960 cases, the population the item is about), 3,000 cohort plans and 1,500 targeted (injury) plans.
Then `measure:fitness`, `cohortShape`, the use-case envelope and the property sweep on the N = 30 prototype. Live plans
read-only.

## Why it matters

§82 floor-protects an easy run against the runner's weekday limit: below 4 km the run is held at 4 km and the limit is
exceeded. §82 Am.1 bounded that overrun as "a few minutes", relying on §52b. §52b counts km per day and cannot see time,
so for a slow runner nothing bounds it. Live: a91d8fde (easy pace about 13:05/km, weekday limit 30 min) is given 4 km
easy runs of about 52 minutes, 48 times.

## Results

| | Slow grid, N = 30 | Slow grid, N = 35 | Cohort, N = 30 | Cohort, N = 35 | Targeted, N = 30 | Targeted, N = 35 |
|---|---|---|---|---|---|---|
| Plans changed | 605 / 960 | 393 / 960 | **1,300 / 3,000** | **0** | **882 / 1,500** | **0** |
| Weekday overruns | 8,921 → 2,101 | 8,525 → 1,932 | unchanged | — | none | — |
| Overrun minutes | 111,810 → 29,980 | 108,850 → 27,701 | unchanged | — | none | — |
| Weekly minutes, changed plans | −6.2% | −7.3% | −0.5% | — | −2.1% | — |
| Peak week down > 5% | 201 | 185 | 14 | — | 0 | — |
| Weeks gaining a run day | 0 | 0 | 0 | — | **339** | **0** |
| New errors / refusals | 0 | 0 | 0 | 0 | 0 | 0 |

- **Who N = 30 reaches.** 4 km takes more than 30 minutes at any easy pace slower than 7:30/km, which is most beginners:
  the engine's default beginner easy band is about 8:15/km. So N = 30 changes typical beginner plans, not only slow ones:
  80% of the targeted grid's easy runs get shorter.
- **The run-day effect is §52b's interaction.** Injury-capped weeks place `floor(remaining volume / easy floor)` easy
  runs. A lower floor lets the same volume fill more days, so at N = 30, **339 injury weeks gain a run day**. At N = 35, 0.
- **N = 35 reaches only easy paces slower than 8:45/km.** It keeps 77% of the overrun relief and changes no cohort or
  targeted plan.
- **Volume.** On the slow grid every plan that loses more than 10% of its peak week is a runner with a weekday limit
  (84 at N = 30, 83 at N = 35), and **every one already carries §40c's weekday-limit note**, before and after. Uncapped
  plans losing more than 10%: 0. The loss is the runner's stated limit being honoured.
- **`measure:fitness` (N = 30):** never-builds unchanged (0% / 13.1% / 19.1%), marathon personas unchanged. Median
  build rises (injury 36.4% → 45.5%, healthy 28.6% → 30%) because week 1 shrinks, which is not a gain.
- **Gates at N = 30:** `cohortShape` and `planFitness` pass. The envelope moves HM fit-for-purpose 96.2% → 98% and
  degenerate weeks 2.3% → 0.4% (a declared move, not a failure). Sweep 17,417 plans, no new violation (2 more plans
  generate than before).

## Live

17 of 30 live plans have an easy pace slower than 7:30/km (N = 30 reaches them all). Only **2** are slower than 8:45/km,
both with a weekday limit: a91d8fde (48 weekday easy overruns) and 799c49e8 (15).

## Ruled ground

- **§9 Amendment (2026-10-27):** a quality session meets its floor at 5 km or 35 minutes, because the floor is "time on
  feet, not ground covered". This is the same question for the easy run.
- **§82 / §82 Am.1:** floor protection; "a few minutes" is scoped to the magnitude ruled on.
- **§52b:** a training day carries a real session, in km (`MIN_KM_PER_TRAINING_DAY = 5`). Unchanged by either option.
- **§94 Am.3:** frequency is a named load driver when per-session load does not rise. The 339 extra run days are that.
- **§40c:** a life-first constraint that suppresses at least 10% is stated. It already is, in every case measured.
- **S9-DURATION-FLOOR-01:** a minutes floor is a coaching decision.

## Options

| | Easy floor | For | Against |
|---|---|---|---|
| **A** | 4 km (unchanged) | No change | 52-minute runs against a 30-minute limit, unbounded for slow runners |
| **B** | 4 km or 30 min | Most overrun relief | Changes most beginner plans; 339 injury weeks gain a run day |
| **C** | 4 km or 35 min | 77% of the relief; touches only easy paces slower than 8:45/km; no run-day change | Leaves a 5-minute overrun at a 30-minute limit |

## What this does not prove

A prototype, not a build: the pace came from a module-level global, and parity on the main grid was not run (it carries no
pace axis slow enough to reach N = 35). The slow-goal grid has 2 weekday limits (none, 30). No device. The 35 was chosen to
match `QUALITY_FLOOR_MINS`, then measured; 25 and 40 were not.

---

## 🔴 Correction (same day, found at build): the 35-minute evidence was wrong, and a narrower option

**The prototype rounded the minutes floor DOWN to the 0.5 km grid**, so a floor-held easy run could come out shorter than
the floor it was meant to honour: at 8:56/km, 3.5 km is 31 minutes, which meets neither 4 km nor 35 minutes. The ruling's
headline, "keeps 77% of the overrun relief", came from those runs. Rounded UP, as the ruling's words require:

| Slow grid | Evidence the board saw (35, rounded down) | 35, rounded up (the ruling as worded) |
|---|---|---|
| Plans changed | 393 / 960 | 301 / 960 |
| Weekday overruns | 8,525 → 1,932 | **6,784 → 6,784, no change** |
| Overrun minutes | 108,850 → 27,701 | 93,707 → 55,549 (−41%) |
| Worst peak loss | 21.7% | 14.1% |
| Cohort / targeted changed, day-count changes | 0 / 0, 0 | 0 / 0, 0 |

A 35-minute run is always over a 30-minute limit, so the count cannot fall. On the 0.5 km grid the floor drops below 4 km
only at easy paces of 10:00/km or slower, so live reach falls from 2 plans to 1 (a91d8fde).

**Option D, measured: change §82 only.** The floor binds against the runner's limit in one place, §82's floor
protection. D leaves construction alone and changes only that step: on a capped weekday, a floor-held easy run lasts
the runner's limit, or N minutes if the limit is below N, and never more than 4 km. Distance follows from the minutes
(0.1 km), as §82's held run already does.

| Slow grid | D, N = 30 | D, N = 35 |
|---|---|---|
| Plans changed | 220 / 960 | 220 / 960 |
| Weekday overruns | 8,480 → **1,660** (−80%; the rest are long runs and structured sessions §81 exempts) | 8,480 → 8,480 |
| Overrun minutes | 108,481 → 26,651 (−75%) | 108,481 → 63,889 (−41%) |
| Weekly minutes, changed plans | −13.3% | −7.2% |
| Worst peak loss | 21.7% | 15.5% |
| Cohort / targeted changed | **0 / 0** | 0 / 0 |
| Day-count changes | **0** | 0 |
| Plans losing > 10% of peak, all with a limit, all carrying §40c's note | 83 of 83 | — |

D reaches only runners with a weekday limit whose 4 km takes longer than it. Live: 4 plans (799c49e8 15 overruns,
c848fd4c 45, 4b037d2c 46, a91d8fde 48: 154 in all). **The sweep found one gap at N = 30:** `INV-PLAN-EASY-FLOOR-PROTECTION-
DECLARED` (127 plans) does not recognise a held run below 4 km, so the declaration must be taught the new shape at build.
**Already true of the engine:** a duration-anchored beginner easy run is capped to the limit with no floor at all, and
`invariants.ts` records that "30 minutes is a real session whatever it converts to".
