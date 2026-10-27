# Coaching Board submission: what race day tells a runner whose goal pace was withheld (2026-10-27)

**Input:** `RACE-DAY-PACE-WITHHELD-01`, filed by the code review of GOAL-PACE-REACHABLE-01; founder: "Take the race-day
question to the coaching board". Measured read-only at HEAD `1ce2f42f`.

## Where race day speaks to the runner (measured, not assumed)

| Surface | What it says today | Reaches the runner? |
|---|---|---|
| Race session `coach_notes[0]` (`raceSession()`) | time goal: *"Start slower than feels right. First {12% of race} at goal pace: {goal}."*; finish goal: *"… at Zone 2."* | **Yes**, the race-day session card |
| Race-week `race_notes` | ≤10K: *"… then settle into goal pace."*; longer: *"Start at Zone 2. The second half is where the race begins."* | **No.** No component renders the field (grep of `app/` and `components/`: 0 readers). Inert copy |
| AI race-readiness note (`raceReadiness.ts`) | No pacing instruction in the prompt | Not a pacing surface |

So the question is one sentence: the race session's opening line.

## Ruled ground

- **§80 Amendment 1 (2026-09-14):** the opening is 12% of the race; "the effort follows the GOAL, not a fixed zone. A
  time-targeted race opens at goal pace, **which is the pace the entire plan has been rehearsing**." For a withheld
  runner that reason is false: past the §120 Am. 2 line the plan rehearses no goal pace at all.
- **§120 Amendment 2 (2026-10-27):** past 5% beyond current race fitness, goal-paced work is not prescribed; the plan
  says *"sessions are set to what you can run now"*. The race-day line is the one place that still says goal pace.
- **§24d / finish-goal opening:** Zone 2 is right for a finish goal; §80 Am.1 ruled it wrong for a time goal at 5K/10K
  ("gives away the race").

## The runners it reaches (live, 10 benchmarked plans past the line)

| Plan | Race | Goal pace | Current race-fitness pace | Gap |
|---|---|---|---|---|
| 6d85424b | 10K | 4:30/km | 4:56/km | 8.7% |
| 1ee07aed | 10K | 4:36 | 4:58 | 7.5% |
| e49ea589 | 5K | 4:24 | 4:51 | 9.2% |
| d933dc40 | 5K | 5:12 | 5:49 | 10.7% |
| c8aef8f9 | 5K | 5:36 | 6:30 | 13.9% |
| 3a83ea55 | MAR | 5:34 | 5:57 | 6.4% |
| c848fd4c | MAR | 6:45 | 7:33 | 10.6% |
| 3cc7c3a9 | MAR | 4:16 | 4:52 | 12.5% |
| a91d8fde | MAR | 8:32 | 11:34 | 26.3% |
| 799c49e8 | MAR | 4:59 | 7:47 | 36.0% |

Today, 799c49e8 would be told to open a marathon at 4:59/km, 2:48/km faster than the pace their benchmark predicts.

## Evidence on race pacing for recreational runners

- A large split-time analysis of marathon finishers found ~76% positive-split and ~24% paced evenly; even pacers
  finished ~59.5 minutes faster than strong positive-splitters (PLOS ONE).
- Reviews find slight negative splits common among elites but not universally applicable; individualised plans by
  fitness are recommended (PMC12307312).
- In a 14-marathon US analysis, non-elite women were more likely than men to hold pace (secondhand summary).
- Not found: a study isolating the mechanism of "hitting the wall"; the fast-start-then-slowdown pattern is what is shown.

## Options

| | Opening for a withheld runner | For | Against |
|---|---|---|---|
| **A** | Unchanged: open at goal pace | No change | Contradicts the plan's own note; the start most likely to produce a positive split, at gaps up to 36% |
| **B** | Open at **current race-fitness pace** (benchmark-predicted), even pace; the goal is a second-half option if it is going well | Evidence-aligned; honest; uses a number the engine already has | Needs founder words; the pace is fixed at build (see below) |
| **C** | Zone 2 opening (the finish-goal line) | Existing copy | §80 Am.1 ruled it gives away a 5K/10K |

**A build note the board should know:** the opening line is text generated with the plan. A later recalibration (ADR-014)
rewrites forward session paces, not this sentence, so a number in it can go stale (`RECAL-GOAL-REACH-01` is the related
open item). Storing the opening pace as a session field the screen renders would let it follow recalibration.

## What this does not prove

The race-fitness estimate is from each runner's benchmark at build time (with the engine's discount), not their fitness
on race day; the plan may have improved them by the 3.5–7.3% the literature reports. No device. The pacing evidence is
marathon-heavy; 5K/10K-specific recreational data was not found in this search.

## Sources
- *Pacing strategy patterns and performance outcomes in marathon running: a large-scale analysis of split time data*, PLOS ONE — https://pmc.ncbi.nlm.nih.gov/articles/PMC13379030/
- *The physiology and psychology of negative splits*, review — https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12307312/
- *Marathon pacing strategies: is negative splitting really the holy grail?*, Statistics Views — https://www.statisticsviews.com/article/marathon-pacing-strategies-is-negative-splitting-really-the-holy-grail/
