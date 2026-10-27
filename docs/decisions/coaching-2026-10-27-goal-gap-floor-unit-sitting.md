# Coaching Board — goal pace past fitness, and the unit of §9's floor (2026-10-27)

**Trigger:** soft, qualifies: changes what the engine prescribes (§22, §25, §120 Am.1, §9, §8/D-21, §82 Am.1).
**Evidence:** `docs/decisions/coaching-2026-10-27-goal-gap-and-floor-unit.md` (read in full), plus one measurement made
at the sitting (below). **Proposed:** Q1 a reachability line for goal-paced work at every distance; Q2 §9's quality floor
met in minutes as well as km; Q3 whether Q2 extends to the easy floor.

## Measured at the sitting: each band's distance from race-fitness pace

`buildPaceFromVDOT` vs `estimateRaceSeconds`, VDOT 16–52. **The bands are fixed offsets from race pace, VDOT-invariant
within 0.4pp.**

| Race | T | CV | I |
|---|---|---|---|
| 5K | −9.8% | −5.4% | **+1.1%** |
| 10K | −6.2% | −2.0% | **+4.3%** |
| HM | +1.2% | **+5.1%** (the §120 Am.1 line) | +11.0% |
| MAR | **+5.8%** | +9.6% | +15.2% |

(+ = the band is that much faster than the runner's own race pace at that distance.)

## Conflict scan (sections and amendments)

- **§22** MUST price second-half build/peak quality at goal pace, ±2%; the ratio arm **binds at every distance, 5K
  included** (SC-05). Q1 past the line contradicts it as written: needs an amendment, not an exception.
- **§22 Am. (10-06)**: a session §22 no longer expects goal-paced leaves the ratio's denominator; **both halves or
  neither**. The bare prototype added +4,234 per-week and +1,102 ratio firings because it did neither.
- **§22 Am.3 (10-23)**: 5K and 10K-beginner goal pace in reps. Unchanged inside the line.
- **§25**: HM/MAR peak long run MUST carry a race-pace segment. Prototype: +616 `RACE-SPECIFIC-LONG-RUN`. Q1 reaches it.
- **§120 Am.1 (09-22)**: HM anchor withheld past CV, **withheld not capped**; and **rejected a percentage form** as
  "right question, wrong unit", on duplicate-semantics grounds with `INTENSITY_ORDERING_TOLERANCE_PCT`.
- **§83 / CD-16, §44 Am.2**: reconcile **or** declare. Today the engine declares. Q1 makes it reconcile past the line.
- **GOALPACE-5K-01 S2 (10-23)**: direction CORRECT, projection INSUFFICIENT EVIDENCE. Q1 settles S2 without a projection.
- **§8 Amendment / D-21 (09-03, recorded at §19's migration note)**: *"the distance floor is the harder constraint, not
  the ceiling"*; `pacedRepPlan` grows reps past the dose. **Q2 reverses that ordering for slow runners. Named.**
- **§52b**: `MIN_KM_PER_TRAINING_DAY = 5 = MIN_SESSION_DISTANCE_KM.quality` by design ("a day must be sized for the
  biggest thing that might land on it"). Q2 loosens the quality floor and leaves §52b in km: a known inconsistency.
- **S9-DURATION-FLOOR-01 (09-19)**: a minutes floor is "a coaching decision". This is that decision.
- **§82 Am.1 (10-03)**: overrun bounded by §52b, not a number. §52b counts km per day and cannot see a time limit, so
  for a slow runner the bound does not reach. Q3.
- **§1**: counts sessions. Neither question changes a session count. No effect.

## The seats

🏃 **Hutchinson (chair).** P is still a forecast with no data: production has zero usable improvement cases, and the
literature gives a mean (3.5–7.3% over 9–10 weeks) with individual response that varies more than the mean. A mean is a
fine boundary for *what a plan can plausibly ask*; it is no basis for *what this runner will become*. So I rule the line,
not a projection. On the unit: §120 Am.1 rejected a percentage because it duplicated a rounding tolerance. Today's
measurement changes the facts under that objection: the bands **are** fixed percentages of race pace, so at HM a 5% line
and the CV line are the same rule within 0.1pp. The percentage form is the only one that reaches 5K, where interval pace
is race pace and no band sits above it. One constant, measured, and §120 Am.1's CV comparison is subsumed by it, provided
the build shows HM moves by no more than rounding. On estimated fitness: an estimate from volume cannot withhold a
runner's race pace. Benchmarked runners only.

📊 **Seiler.** No §1 effect. The direction is right: past the line the runner moves from impossible work back to their own
threshold, which is less grey-zone, not more. Two conditions. First, I would rather keep the band map (10K→I, HM→CV,
MAR→T) because it reads the runner's own ladder; I accept the percentage only because the table shows it is the same
thing and 5K has no band. Second, **the cohort grid cannot see this constant** (every benchmarked goal sits at 10–14%): the
build is measured on the slow grid's gap axis or it is not measured.

🎯 **McMillan.** Ten of thirteen live runners lose goal-pace rehearsal at 5%, and most of them are marathoners. I still want
a projection, and I accept I cannot have one without data. What I will not accept is the marathoner losing §25's long-run
finish entirely: a finish at **their current marathon pace** is runnable, honest ("marathon-pace", not "goal-pace"), and is
the adaptation §25 exists for. I ask that past the line §25's segment be priced at current race-fitness pace, not withheld.

🩹 **Willy.** Sustained work faster than I for a novice adding volume is a tissue load I would not sign. Supports the line.
On McMillan's §25 ask: a current-MP finish is easier than today's prescription, so no injury objection, but it is
unmeasured. On Q2: fewer reps is less load; supports. Q3 shortens easy runs for slow runners, which moves weekly volume:
measure it before ruling.

⚕️ **Sims.** The Make-A-Wish cohort is aspirational first-timers, many women, many past this line. A plan they cannot run
teaches them to fail, and a goal privately chased outside the plan is where low energy availability starts. Supports the
line **only with the gap named to the runner**, at every distance, which is the condition I set on 10-06. Copy to the
founder, placement to the Design Board.

💪 **Blagrove.** No objection from this seat.

## Recorded disagreements

- **Seiler vs Hutchinson on the unit**: band map vs one percentage. Settled by the table (identical where a band exists);
  Seiler's preference recorded.
- **McMillan vs Willy/Hutchinson on §25**: current-pace finish now vs withheld until measured. Settled by measuring it
  at build: if a current-pace finish clears §25's checks with no new violations and `measure:fitness` holds, it ships;
  otherwise the segment is withheld.
- **McMillan on projection**: still prefers P. Stands open until there is production data (post-race results or repeat
  benchmarks) to measure gain.

## Ruling

| Item | Ruling |
|---|---|
| **Q1 — the line** | **CORRECT WITH AMENDMENT.** On a benchmarked time-target plan, goal-paced work is prescribed only while the goal is within `GOAL_PACE_MAX_STRETCH_PCT` (**5**) of the runner's current race-fitness pace at the race distance. Past it: goal-anchored rows are withheld and §22's override does not reprice (both through one owner), §22's ratio and per-week arms exempt such sessions (both halves), §25's segment per the measured §25 arm below, and the gap is named to the runner. **Supersedes §120 Am.1's CV comparison**, gated on the build measuring HM movement as rounding only. |
| **Q1 — §25 arm** | **CORRECT, build-measured.** Past the line, the long-run finish runs at current race-fitness pace, labelled for the distance (never "goal"), if it adds no violation and `measure:fitness` holds; else withheld. |
| **Q1 — P (projection)** | **INSUFFICIENT EVIDENCE**, unchanged. Settles with post-race results or repeat benchmarks in production. |
| **Q1 — plan-length scaling** | **INSUFFICIENT EVIDENCE.** No data on gain by block length. |
| **Q1 — estimated fitness** | **Not gated.** Unbenchmarked plans unchanged; stated as negative space. |
| **Q1 — the note** | **CORRECT in principle** (Sims, binding). Founder's words, Design Board's placement. Build does not ship the line without it. |
| **Q2 — quality floor** | **CORRECT WITH AMENDMENT.** A quality or secondary-quality session meets §9 at ≥ 5 km **or** ≥ `QUALITY_FLOOR_MINS` (**35**) total. One owner, read by every quality shape builder and the check; a population gate enumerates the builders. **Amends §8/D-21's "floor beats ceiling"**: the dose band governs once the session is 35 minutes. §52b stays in km for now, named as an open inconsistency. |
| **Q3 — easy floor** | **Direction CORRECT; INSUFFICIENT EVIDENCE** to build. Prototype "≥ 4 km or ≥ 30 min", measure weekly volume, `measure:fitness`, §52b and §82 interplay, then a sitting. |

**Measurement required at build (Willy, Seiler binding):** slow grid by gap, cohort grid, sweep, `cohort:shape`,
`measure:fitness`, HM before/after for the §120 supersession, and prescription parity showing finish-goal and
unbenchmarked plans byte-identical.

## Artifacts (at build, one commit per ruling)

| | Q1 | Q2 |
|---|---|---|
| Principle | §120 Amendment 2 (the line, every distance; §22 and §25 consequences) | §9 Amendment (minutes form) + §8/D-21 note amended |
| Numeric | `GOAL_PACE_MAX_STRETCH_PCT` = 5 | `QUALITY_FLOOR_MINS` = 35 |
| Invariant | `INV-PLAN-GOAL-PACE-REACHABLE`: no goal-paced step faster than the line, derived independently of the producer | `INV-PLAN-MIN-SESSION-SIZE` reads the minutes form; builder-population gate |

## SLT escalation
None. Correctness only.

## Not settled
Projection (P); plan-length scaling; Q3; §52b's unit; the note's words (founder) and placement (Design Board).
