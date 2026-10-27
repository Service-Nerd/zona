# Coaching Board submission — goal pace past fitness, and the unit of §9's floor (2026-10-27)

**Input:** the 26 Oct coach-engine RCA (`docs/investigations/2026-10-26-coach-engine-digest-rca.md`), items 1–3, after
steps 1 (GRID-SLOW-GOALGAP-01) and 2 (OVERRUN-NOTE-ALL-01). Founder's standing instruction for this sitting:
*"run thorough analysis before you propose fixes … We can NOT get the coach engine wrong or impact it in a negative way."*
All measurements below are read-only, from HEAD `bacb2858`, prototypes in a throwaway worktree (nothing committed).

## Ruled ground this sitting must not re-open

| Ruling | What it already decided |
|---|---|
| §120 Am.1 (2026-09-22) | HM goal anchor **withheld, not capped**, past CV + 0.5%. Capping rejected: "HM-pace reps" at a non-goal pace is the header defect. Measured: goal crosses CV at **5.4–6.2%** of current HM pace |
| §44 Am.2 (2026-10-06) | The difficulty band speaks at CV (HM). A goal past fitness is **declared** |
| GOALPACE-5K-01 S2 (2026-10-23) | *"Price at an attainable pace when the goal is beyond fitness"*: **CORRECT in direction; projection INSUFFICIENT EVIDENCE** ("how much VDOT a beginner gains in 8–12 weeks has no measured basis"). Hutchinson (short reps at goal, sustained at fitness) vs McMillan (all second-half work at a projection) recorded |
| §22 Am. (2026-10-06) | A session §22 no longer expects goal-paced **leaves the ratio's denominator**. Both halves or neither: override and per-week check together |
| S9-DURATION-FLOOR-01 (2026-09-19) | §9 has no minutes form. Duration-anchored sessions (beginners) are unchecked; shortest measured: 30 min easy, 25 min quality. A minutes floor was "a coaching decision, not a defect fix" |
| §82 Am.1 (2026-10-03) | Floor-protected overrun bounded **structurally by §52b, not by a percentage** |

## Question 1 — how far may goal-paced work outrun current fitness, at every distance?

**The defect (measured).** Two paths price goal pace and neither asks whether it is runnable: `race_specific` rows anchored
`goal` (via `resolveAnchorPace('goal')`, unbounded at every distance) and §22's goal-week override of T rows (`useGoalPace`,
reads `goalPace` directly). Only the `HM` anchor is bounded.

Slow grid (`npm run measure:goal-gap`, 880 plans): share of goal-paced sessions faster than the runner's own paces.

| Goal past fitness | 5K | 10K | HM | MAR |
|---|---|---|---|---|
| 0% | faster than T/CV, not I (normal) | same | 0% | 0% |
| +5% | 100% faster than I | 20% faster than I | 100% faster than T | 0% |
| +15% | 100% faster than I | 100% faster than I | 100% | 100% faster than T, 20% than I |
| +30% | 100% faster than I | 100% | 100% | 100% faster than I |

**Live (13 benchmarked runners with a future time goal):** gap to current fitness −5.5, −0.2, 6.4, 7.5, 8.7, 9.2, 10.6,
10.7, 12.5, 13.9, 17.6, 26.3, 36.0%. **Median ~10%.** 5 more have no benchmark.

**Evidence for a projection constant.**
- **Production: none usable.** 1 post-race result (100K, no benchmark), 0 Apple Watch VO2max samples, 2 runners with
  repeat benchmarks, both re-entered within days. The repo cannot measure improvement and will not for months.
- **Published:** a 10-week randomised trial in recreational runners improved 10K time **5.0% (polarised) and 3.5%
  (threshold)** (Muñoz et al. 2014). A systematic review reports a **7.3%** time-trial gain over 9 weeks with ~27% more
  volume and ~10% VO2max over ~10 weeks. Response varies widely between individuals (in sedentary adults over 20 weeks,
  7% barely changed while 8% gained more than 1.75× the mean).
- **Coherence:** §120 Am.1's measured CV line (5.4–6.2%) sits inside that 3.5–7.3% range.

**The grids.** ⚠️ **Every benchmarked time-target case in `cohortGrid` sits at a 10–14% gap** (and half have no benchmark),
so the cohort grid cannot distinguish a 3% line from an 8% one: prototypes at 3/5/8% changed the same 1,371 of 5,925 sampled
plans. Only the slow grid's 0/5/15/30% axis discriminates.

**Prototype (bare withholding, no §22 amendment), to show what the board must rule together.** Pricing goal work as
fitness past X% (X = 3/5/8): goal-paced sessions faster than T fall to 0% everywhere past the line, **and §22's checks fire
in the thousands** (cohort/7: `RACE-SPECIFIC-EXPOSURE` +4,234, `-RATIO` +1,102, `-LONG-RUN` +616, `PEAK-RACE-SPECIFIC-REACHED`
+366, `TAPER-VARIETY` +315). This is §22 Am.'s "both halves or neither": a withholding rule must carry §22's denominator and
per-week exemption, exactly as §120 Am.1 did. It also raises km-floor breaches (442 on the slow grid), which Question 2
removes.

**Options for the board.**

| | Rule | For | Against |
|---|---|---|---|
| **W** | Generalise §120 Am.1: past X% beyond current race fitness at that distance, goal-paced work is **not prescribed**; §22 exempts it (denominator + per-week); the gap is named (band/note, Sims's condition) | Ruled shape, no forecast needed, one owner (`resolveAnchorPace` + the override reads the same predicate) | Removes race-pace rehearsal for most live runners (10 of 13 at X=5%) |
| **H** | Hutchinson's S2: goal pace kept **only in short reps** (§22 Am.3 shapes) up to the line; sustained goal work priced at fitness; past the line, as W | Keeps "feel race pace" | Needs a second line for reps; more rules |
| **P** | McMillan's S2: price at a **projected** pace (fitness × assumed gain per week) | Trains toward a moving fitness | **No measured basis**; individual response varies more than the mean; the board already called this insufficient evidence |

**Open for the board:** X per distance (one constant, or by distance as the 5K/10K race paces sit nearer I); whether X
scales with plan length; whether an **estimated** fitness (no benchmark) may gate goal pace at all.

## Question 2 — is §9's quality floor in kilometres or minutes?

**The defect (measured, slow grid).** The 5 km quality floor fails both ways for a slow runner:
- **Over-applied:** `pacedRepPlan` grows reps until the session prices at 5 km, past the dose ceiling. VO2 work reaches
  **26 minutes against the 12–18 minute dose band** (24 `VO2MAX-MAIN-SET-CAP`); sweep clones add 122 `GOAL-PACE-SHAPE`, 1 ordering.
- **Missing:** `progressiveTempoPlan` / `fixedShapePlan` never apply it, so 204 sessions sit under 5 km. **Every one is
  39–50 minutes long** (`progressive_tempo` 39–43, `threshold_pyramid` 43, `threshold_ladder` 50).

A km floor is the wrong question for a slow runner: a 43-minute session is not "too short to be coaching-meaningful".

**Prototype: a quality session meets §9 at ≥ 5 km OR ≥ N minutes** (rep growth stops at N minutes; the check accepts either).

| N | slow grid (960) | served cohort sample (5,925) |
|---|---|---|
| 30 | all four codes → **0**, 598 plans change | 1,576 plans change |
| **35** | all four codes → **0**, 598 plans change | **221 plans change**: all HM/marathon beginners, `tempo_continuous` 38 → 36 min (the dose now governs, not the floor). Nothing else |
| 40 | 80 `MIN-SESSION-SIZE` remain (progressive tempo at 39 min), 580 change | 14 plans change |

`npm run measure:fitness`: **identical** with N = 35. No error-severity violation added anywhere.

**Consistency:** beginners are duration-anchored and already have no km floor; their shortest quality session is 25 min.
A minutes form aligns slow distance-anchored runners with them.

## Question 3 — the floor-protected easy-run overrun: already ruled, but the ruling does not reach

§82 Am.1 bounds the overrun **by §52b, not a number**. But §52b's rule is **km per training day** (5 km), and it never sees a
weekday **time** limit: tasha (VDOT 16) has the km for her days and still gets 52 minutes on a 30-minute Friday. So for a
slow runner nothing bounds it. It is the same km-vs-minutes question as Question 2, for the **easy** floor (4 km at 12 min/km
is 48 minutes). The disclosure now exists (OVERRUN-NOTE-ALL-01). **The board is asked whether Question 2's ruling extends to
the easy floor** (shortest duration-anchored easy run measured: 30 min). ⚠️ That floor has ~27 call sites; not prototyped.

## What this does not prove

No device. Live counts are 13 benchmarked plans. The W/H prototypes were bare (no §22 amendment), so their fitness and
cohort-shape cost is **not measured yet** and must be, after the ruling, before build. The literature figures are means
from small trials, not this population. Question 3 was argued, not prototyped.

## Sources
- Muñoz I et al. (2014), *Does polarized training improve performance in recreational runners?* —
  https://www.researchgate.net/publication/237096628_Does_Polarized_Training_Improve_Performance_in_Recreational_Runners
- *Effect of aerobic training volume on VO2max and time trial of runners: a systematic review* —
  https://www.jhse.es/index.php/jhse/article/download/aerobic-training-volume-runner-performance/58/2044
- Bacon AP et al. (2013), *VO2max trainability and high intensity interval training in humans: a meta-analysis* —
  https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3774727/
