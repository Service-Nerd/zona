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

## 1. The six questions, and which tool answers which

**Each step answers a question no other step can.** That is why there are six and
not one, and why three of them being green tells you almost nothing on its own.

| # | Step | The question it answers | Fails when |
|---|---|---|---|
| 1 | `coaching-review-round` | Does every canonical case and persona still **generate a valid plan**? | a plan breaks its own constitution, or an honesty guard weakened |
| 2 | `foundation-review-round` | And do they still generate valid plans **with a foundation block composed on** — the path a real runner with a runway takes? | a composed plan violates an invariant, or leaves uncovered runway with no note |
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
