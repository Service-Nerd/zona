# How we measure the coaching engine

**The single owner of "how do we know the engine is good, and getting better".**

Run it with one command:

```bash
npm run review:coaching            # the full protocol, ~70 seconds
npm run review:coaching -- --fast  # skips the two corpus runs, ~16 seconds
```

**Run it after every coaching-engine change, and periodically regardless.** The
CI trigger fires it on any push to `main` touching a doctrine file; the periodic
run is the one that catches drift nothing pushed.

---

## ⚠️ Why this file exists

There are eight measurement commands in `package.json`. Until 2026-09-23
`coaching-rulings.md` listed **four** of them as *"how to re-run the review and
compare like with like"*, and that list went stale the moment `review:cohort` and
`measure:fitness` existed. **A protocol written as prose in one document and
executed by hand in a different order each time is not a protocol — it is a
memory test.** This repo has recorded what happens to those: the coaching review
loop itself went dormant for exactly that reason and had to be rebuilt around a
CI trigger.

So the order lives in `scripts/review-coaching.ts`, this file explains **what
each step is for**, and neither restates the other.

---

## 1. The seven questions, and which tool answers which

**Each step answers a question no other step can.** That is why there are seven and
not one, and why three of them being green tells you almost nothing on its own.

| # | Step | The question it answers | Fails when |
|---|---|---|---|
| 1 | `coaching-review-round` | Does every canonical case and persona still **generate a valid plan**? | a plan breaks its own constitution, or an honesty guard weakened |
| 2 | `foundation-review-round` | And do they still generate valid plans **with a foundation block composed on** — the path a real runner with a runway takes? | a composed plan violates an invariant, or leaves uncovered runway with no note |
| 2b | `measure:goal-gap --gate` | Do **slow runners with an ambitious goal** get paces they can run, sessions big enough, and every weekday overrun said? *(RCA-1026, added 2026-10-27: every defect in the 26 Oct ops report lived on these runners, and no step above reaches them; the cohort grid's slowest benchmark is a 27:30 5K)* | any goal-paced session faster than the runner's interval pace, any goal-paced work 15%+ past fitness, any §9 floor breach, any silent weekday overrun, or any error violation on the 880 slow-grid plans |
| 3 | `measure:envelope` | What share of the **weighted population** gets a plan we would hand over? | any distance moves against the committed baseline, **in either direction** |
| 4 | `review:cohort` | **Which runners** are failing, and what does a refused one **actually receive**? | any volume band's rate moves, an objection appears or disappears |
| 5 | `audit:plans` | Would a **coach object** to these plans, and at what rate? | a new objection class appears above the baseline |
| 6 | `measure:fitness` | Do these plans actually **build the runner**, far enough to finish safely? | `neverBuilds` rises at all, or build/specificity regress past tolerance |

### Why the order is not arbitrary

Generate first. **A doctrine change that broke a case should be loud before
anything else runs** — a sweep failure after a generation failure tells you
nothing you did not already know. Then the population measures, then the corpus
sweeps, which are the slowest and the least specific.

---

## 2. What "better" means, and the one trap

**A rate moving is not automatically good news.** Three distinct things can move
a number, and only one of them is progress:

| What moved | Is it progress? |
|---|---|
| The **engine** — different plans, same measure | **Yes.** This is the only one. |
| The **definition** — same plans, different measure | 🔴 **No. It is a CORRECTION.** |
| The **population** — same plans, same measure, different weights | 🔴 **No.** Every historical number becomes incomparable. |

🔴 **`ZERO-REJECTION-SERVED-01` (2026-09-23) is the worked example and it is why
this section exists.** The marathon went **78.7% → 89.8%** and **not one plan
changed.** A refusal that hands the runner a §118 plan stopped being scored as a
dropout. Hutchinson, binding:

> *"The engine did not get better. Nothing about the plans changed. If this board
> re-scores and the marathon reads ~91%, not one runner is served differently
> than they were yesterday. **A re-score is a correction, never an improvement.**"*

So: `fitPctPreCorrection` is a **field, not a footnote**, and `[was N%]` prints on
every run. **When you re-baseline, say in the commit which of the three moved.**

### Re-baselining is a declared act

```bash
npm run measure:envelope -- --write
npm run review:cohort -- --write
```

**Never to turn a red run green.** Say which number moved and why, in the commit.
Both baselines are versioned or stride-locked so an incomparable one is refused
rather than silently compared.

---

## 3. What is held fixed, so a run is comparable to the last one

| Held fixed | Where |
|---|---|
| the runners | `lib/plan/charityCohort.ts` — 21 personas + 7 canonical cases |
| the weighted population | `lib/plan/useCaseEnvelope.ts` — bands and weights, each with a written reason |
| what "a coach would object to" | `lib/plan/planQuality.ts` — 7 predicates, one owner |
| what "fit for purpose" means | `lib/plan/envelopeMeasure.ts` — one owner, shared by script and gate |
| last round's numbers | `lib/plan/__fixtures__/envelopeBaseline.json`, `cohortReviewBaseline.json` |
| what the board already decided | `docs/canonical/coaching-rulings.md` |

⚠️ **`generated-plans.md` is gitignored**, so an old round's plan TEXT cannot be
diffed. Plan-level change detection is `npm run verify:parity`, which hashes
5,994 cases. **Use that, not the round files.**

---

### Staged race plans (NO-RUNNER-TURNED-AWAY-01, Q4, ruled before the build)

A §111 refusal that the engine can stage is scored as its **composed plan**: the base-building weeks plus the race
plan generated from the checkpoint with `current_weekly_km` at the door. One definition, `lib/plan/stagedScore.ts`,
called by `envelopeMeasure.ts` and `cohort-review.ts` (since 2026-10-25 the cohort step counts a staged runner as served, scored clean only if the composed plan is; `STAGED:` marks their objections; refused means only what staging cannot serve). Staged cases leave `refusedPct` and
enter `fitPct`, fit only if clean; `fitPctPreCorrection` remains the founder's bar (every refusal and every unclean
staged plan a fail). `stagedPct`, `stagedCleanPct` and `stagedObjections` are recorded and gated.
The race block is built by `checkpointRaceInput` (the same owner the checkpoint uses) at the plan's own target (C3) with the ramp's longest session, marked observed (C1, C2). **Shipped behaviour is the default** (`onRampEnabled()`, ON since 2026-10-25, and the envelope baseline was re-written to it that day); `--staging` is now redundant and still
refuses `--write`. **What a staged runner gets at the checkpoint** (race block / more base building / the half / a later race, at 100/90/75% compliance) is `scripts/checkpoint-outcomes.ts`, and four typical runners week by week is `scripts/staged-plan-walkthrough.ts`. ⚠️ **The pass-at-the-door assumption is the best case and is printed beside the number.**

### 🔴 2026-11-03 — the population was one the wizard cannot post, and the numbers below are the corrected ones

`ENVELOPE-UNSET-LEVEL-01`. Every case in `useCaseEnvelope` carried `fitness_level`. **No production path sets that
field** — `GeneratePlanScreen` sends `user_declared_level: fitnessLevel ?? levelRec.level` and
`/api/generate-plan` never names `fitness_level` (§79: it is the API's structural declaration and would bind peak
km). The two are not interchangeable: a declaration binds structure **downward only**, so a 10 km/week runner
labelled `experienced` was scored here with an experienced PEAK and is built by the engine with a beginner one.

**The level now goes on `user_declared_level`.** Same bands, same weights, same case count. An `undefined` band was
considered and rejected on measurement: live, `fitness_level` is absent on all 39 plans while
`user_declared_level` is set on 31 of the 32 carrying an input (23 equal to the recommendation, 6 overridden up, 2
down), and the accept path is provably identical to no declaration (`declaredLevel` defaults to
`assessed.intensity`, which is `>= assessed.structural` by construction, so structure stays assessed).

⚠️ **EVERY NUMBER THAT MOVED, MOVED BY DEFINITION. NOTHING IN THE ENGINE CHANGED.** Per
`ZERO-REJECTION-SERVED-01` that makes all of this a **correction, never an improvement.** One cause explains all of
it: the corpus now contains **572 structurally-beginner plans of 1,060 against 366**, because a downward declaration
binds structure down where a forced `fitness_level` could not.

| | was (level forced) | now (wizard's field) | why |
|---|---|---|---|
| WHOLE PRODUCT `fitPct` | 94.4% | **94.7%** | more beginner-structure plans, which carry fewer objections |
| marathon `fitPct` | 85.0% | **84.4%** | the instrument was 0.6pp optimistic even after `RUNWALK-ASSESSED-LEVEL-01` |
| half marathon `fitPct` | 96.2% | **97.7%** | its `WEEK1-LEAP` goes 25% → **0** on the 10 km/wk band |
| marathon `WEEK1-LEAP` | 4.4% | 3.0% | same cause |
| marathon `LONG-RUN-SHORT` | 5.9% | 6.9% | more beginners reach §117, so more land in the watched bucket and more remain short |
| marathon `LONG-RUN-SHORT-RUNWALK` (watched) | 2.8% | 4.6% | ditto |
| marathon `stagedPct` / `stagedCleanPct` | 11.8% / 5.0% | 9.2% / 3.2% | lower structure moves §111's door, so fewer runners stage |
| `DAYS-SHORT-SILENCED` (watched) 5K / 10K / HM | 49.8 / 28.8 / 20.4% | 53.5 / 36.9 / 21.5% | more beginner structure, more silencing |

🔴 **`WEEK1-LEAP` WAS PARTLY AN ARTEFACT OF THIS CORPUS, and three test files exist about it.** Forcing structure
to the band gave a 10 km/week "experienced" runner an experienced peak and therefore a week-1 leap against a 10 km
base — **a leap the product cannot produce.** HM 10 km/wk clean goes **58.1% → 83.2%** on that alone, and marathon
25 km/wk loses it entirely. It is still real at 17.2% on marathon 15 km/wk, so the phenomenon stands; its RATE did
not.

⚠️ **`BINGE-WEEK` IS NEW AND SMALL AND WAS INVISIBLE, NOT ABSENT** — 0.1–1.4% per marathon band, a single session
over §52's 60% cap in the delivered week (the ADR-022 curve-vs-delivered class). Filed as
`BINGE-WEEK-DELIVERED-01`.

🔑 **The per-distance picture, against the founder's 90% floor, measured honestly** (founder approved the
restatement 2026-11-03): 5K **100%**, 10K **100%**, HM **97.7%**, 50K **100%**, 100K **100%**, **marathon 84.4% —
the only distance under the floor, by 5.6pp.** Before `RUNWALK-ASSESSED-LEVEL-01` the same instrument on the same
corpus read **79.2%**.

⚠️ **Two sibling corpora are still blind the same way and are filed, not fixed:** `cohortGrid`
(`PARITY-GRID-UNSET-LEVEL-01`'s twin, feeding `cohort:shape`) and `scripts/verify-parity.ts`, whose 6,102 cases all
carry the field — so parity returns IDENTICAL for any change to a level-gated rule and did exactly that for
`RUNWALK-ASSESSED-LEVEL-01`. **Enumerated 2026-11-03: five rules read `input.fitness_level` raw, three of them dead
in production** (§117 Am.5 — fixed; §117's peak — `RUNWALK-ASSESSED-LEVEL-01-PEAK`; §28 Am.1's hill strides and
`INV-PLAN-BEGINNER-NEUROMUSCULAR` — `STRIDE-ASSESSED-LEVEL-01`).

---

## 4. 🔴 What none of these can see

**Printed at the end of every run, deliberately.** A scorecard that shows only
green ticks is how *"all clear"* comes to mean *"the things this script looks at
are fine"* without anyone noticing the difference — which this repo has recorded
happening to `audit-docs.sh` twice.

- **Nothing has run on a device.** Every number is a generated plan.
- **Nothing measures whether a §118 get-running plan builds the runner WELL**,
  only that it validates. The §118 chair's known gap, still open.
- **Coach objections are measured on plans WITHOUT a foundation block**
  (`HARNESS-COMPOSE-GAP-01`). Step 2 closed the error-severity half; `planQuality`'s
  7 predicates have still never seen one.
- **The population weights are ASSUMPTIONS** with written reasons, not
  observations. Production holds a handful of plans and `plan_refused_by_design`
  has never fired.
- **`verify:parity` is weak evidence for ramp or foundation changes** — its grid
  pins `plan_start`, so it generates none of those plans at all.

---

## 5. The board's use of it

The Coaching Board sitting reads this protocol's output, **after** reading
`coaching-rulings.md` — register first, plans second (the 2026-09-20 protocol).

**Two figures are reported at every sitting**, by standing amendment
(`ZERO-REJECTION-SERVED-01`, Seiler and Sims): **`SERVED`** and **`door`**.
*A watched quantity nobody reads is a hidden one.*

⚠️ **`door` is reported PER BAND, never averaged** (McMillan). 80.3% at 4 km/week
and 100% at 15 are different promises, and a single figure hides the runner who
cannot get there. `review:cohort` is where they live; `measure:envelope`'s
distance-level `door~ N% agg` is an aggregate and **is not the promise**.

---

## 6. The current numbers

**Not repeated here.** They live in `docs/canonical/fit-for-purpose-rubric.md`,
read from the committed baseline. **Two stale figures in one file is not two
mistakes, it is one missing mechanism** — and nothing yet compares that doc's
quoted numbers against the baseline JSON, which is why the rubric taught a
superseded bar for three days. Treat any number written in prose as a claim to
re-derive.
