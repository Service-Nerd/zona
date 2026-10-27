# Coaching Board submission: an easy run that becomes a second long run (2026-10-27)

**Input:** `EASY-RUN-ABSORBS-QUALITY-01`; founder: "Take the easy-run question to the coaching board". Measured read-only
at HEAD `3f672f51` (cohort grid, 3,000 plans by a coprime stride; targeted grid, 1,500; live plans, read-only).

## The item's premise, re-measured

The item says that when a quality session comes in shorter than its share of the week, §9's redistribution sends the
difference to the easy runs, and that the extra **concentrates in one easy run** until it becomes a second long run.

| Measure (cohort, weeks with an easy run ≥ 75 min and ≥ 60% of the long run) | Value |
|---|---|
| Flagged weeks | 4,395 |
| **Every** easy run in the week is that big | **3,154 (72%)** |
| Only some easy runs are that big | 1,241 (28%) |
| Long run at its §9 minute cap (10K 120, HM 135) | 1,732 (39%): 827 10K, 888 HM, 17 marathon |
| Minutes of easy running above 0.8 × the long run, per flagged week | **0.5** |
| Mean weekly running minutes in a flagged week | 365 |

**So the premise is mostly false.** The volume does not pile into one run; it is spread evenly, and almost never past
§9's line. A big easy run happens because the week is big for its day count and, for 10K and HM, the long run has hit
its minute cap. On 3–4 days a 365-minute week cannot be run any other way.

Prevalence by day count (earlier probe, same sample): about 20% of 3–4-day plans and 10–15% of 5-day plans, at every
level.

## What the measurement found instead: §9 is not checked in minutes

`LONG_RUN_MIN_RATIO_VS_EASY` (1.25: the long run is at least 1.25× any easy run) is enforced **in km only**, in both
the producer (`ruleEngine.ts` redistribution) and the checker (`INV-PLAN-LONG-IS-LONGEST` skips any session without
`distance_km`). Beginners get duration-anchored plans (95.8% of their sessions carry minutes, no km), so for them the
rule never runs.

| Population | Plans breaching §9 in minutes | Weeks | Easy runs ≥ 120 min | Worst ratio (easy ÷ long) |
|---|---|---|---|---|
| Cohort, 2,874 plans | **116** (all beginners) | 394 | 41 | **0.99** |
| Targeted, 1,500 plans | **66** (all beginners) | — | — | 0.86 |
| Live, 29 plans with a future race | **2** | — | — | — |

**Worst case (cohort k602):** a declared beginner marathoner at 70 km/week on 4 days. Week 10 has a 157-minute long run
and **two 156-minute easy runs**. No violation fires. Three long runs in a week, and the plan calls two of them easy.

Live: 3 of 29 plans have an easy run of 75+ minutes at 60%+ of the long run (for example 799c49e8 week 8: 89 min beside
116). 2 of 29 breach §9 on both measures.

## Ruled ground

- **§9:** the long run is at least `LONG_RUN_MIN_RATIO_VS_EASY` × the easy run; the engine redistributes "while
  preserving total weekly volume" when the natural split would invert it.
- **§9 Amendment (2026-10-27):** a session's floor is a question about time on feet, not ground covered; beginners are
  duration-anchored. The same reasoning applies to the ratio.
- **§52:** the long run is at most 60% of the week. **§52b:** a day must carry a real session.
- **§40c:** a suppressed target is stated, never absorbed.
- **§82:** easy runs are floor-protected against the weekday cap.

## Questions for the board

1. **The item's question.** May volume concentrate in easy runs to the point of an easy run ≥ 75 min and ≥ 60% of the
   long run? If not, what cap, and where does the volume go?
2. **The finding.** Does §9's 1.25 ratio bind in minutes on a duration-anchored plan?

## Options for Q2

| | | For | Against |
|---|---|---|---|
| **A** | Leave km-only | No change | k602: two easy runs equal to the long run |
| **B** | Ratio in minutes when a session is duration-anchored; the producer redistributes in minutes exactly as it does in km | §9's own rule, applied to the unit the plan uses | The long run grows; it may hit §9's cap or §52's 60%, and the residual has to go somewhere |
| **C** | B, plus volume that cannot fit is dropped and stated (§40c) | Honest about a week that is too big for its days | A fewer-minutes week for the cases at the cap |

**Not measured yet:** no candidate is prototyped. `measure:fitness`, `cohort:shape` and `verify:parity` belong to
the build, before anything ships.

## What this does not prove

The flagged-week shape is from a sample of the grids, not every plan. The minutes breach is counted with each session's
`duration_mins`, which for duration-anchored sessions is the prescription itself. No device. Why k602's long run stops
at 157 minutes, short of the 210-minute marathon cap, was not traced. That belongs to the build.
