# DELOAD-PLAN-OPENING-01 — the placement search was built, measured and NOT shipped

**2026-10-05.** The Coaching Board ruled this CORRECT on 2026-10-05 with a named remedy:
*"a search over legal placements scored against §3 / §87 / §95 / §119 / §23, not a threshold"*,
and made it a **prerequisite** of `DELOAD-BADGE-TRUTH-01` because moving deloads changes which
transitions invert.

**The search was implemented in full and it works.** It is not shipped, for reasons measured
below. This document exists so the next attempt starts from evidence instead of repeating the
build.

---

## The premise, re-derived (and sharpened)

`INV-PLAN-MIN-LOADING-BLOCK`, 39,632 cohort plans:

| | |
|---|---|
| plans firing | **25.8%** (10,228) — the filing said 30.8% of the property sweep |
| **week the firing lands on** | **week 2 — 100.0% of firings** |

The opening-block claim is exact. What the filing did **not** say is that it is overwhelmingly a
**long-race** defect:

| distance | plans firing |
|---|---|
| 5K | 2.8% |
| 10K | 2.8% |
| **half marathon** | **52.1%** |
| **marathon** | **49.9%** |

A **19x gradient.** Over half of all HM and marathon plans opened with a week-2 deload.

## The mechanism

`computeDeloadWeeks`'s **backward normalisation** is what parks it at the front: its own comment
records `{3,5,8} -> {2,5,8}`. §95's `dueIn2` creates the too-close pair; normalisation then pulls
the earlier deload back to week 2.

## The search, as built

A DP over in-scope weeks (`E`, peak and taper excluded), in **E-index space** so a peak week can
never be counted as a loading week.

- **Hard:** not a phase's first week (§87); not phase position 2 (§95/§108); every loading run
  `>= MIN_LOADING_BLOCK_WEEKS` (2) **including the opening run**; trailing run `>= 1` so the plan
  still loads into its peak.
- **Bound by the two ratified constraints from §95's reverted first build**, both read off the
  legacy placement rather than assumed: deload **count may rise, never fall** (Willy), and the
  **worst loading run may never lengthen** (Sims, §87 rule 3). Encoded as `run <= maxRun`.
- **Soft:** minimise `Σ |gap − recoveryFreq|`.
- Returns `null` when infeasible; the caller falls back to the legacy walk, so a plan is never
  left without deloads. Scoped to `avoidPosition2 === true`, leaving §95 Amendment 1's yield path
  byte-identical as that amendment requires.

✅ **It reproduces the board's own brute-force result.** On the 16-week standard case it returns
`[3,6,10]` — one of the exactly two placements the board found valid (`[3,6,9]`, `[3,6,10]`) —
and it rejects `[4,8,12]` for the right reason: a deload on the **last eligible week** leaves the
peak phase building straight out of a recovery week.

⚠️ **One bound was invented and had to be corrected by measurement.** I first required the
trailing block to be `>= MIN`, by analogy with the other blocks. §119 counts loading weeks
**before** a deload and nothing follows the trailing block, so it never fires there. Corrected to
`>= 1`. ⚠️ **And the correction changed nothing** (6,268 firings either way) — the HM residual has
a different cause, below. **I had diagnosed it wrongly and the fix proved it.**

## What it achieved

| invariant | before | after |
|---|---|---|
| `INV-PLAN-MIN-LOADING-BLOCK` | 10,228 | **6,268** (−38.7%) |
| — marathon | 49.9% | **3.4%** (−93%) |
| — half marathon | 52.1% | **52.1% (unmoved)** |
| `INV-PLAN-DELOAD-IS-A-REDUCTION` | 3,428 | 2,580 (−24.7%) |
| `INV-PLAN-PEAK-IN-PEAK-PHASE` | 1,440 | 1,396 |
| `INV-PLAN-PEAK-NOT-BELOW-START` | 19,576 | 19,576 (unmoved) |
| **`INV-PLAN-DELIVERED-RAMP`** | 10,556 | **11,676 (+1,120)** |
| **`INV-PLAN-HEADER-PACE-MATCHES-WORK`** | 3,232 | **4,416 (+1,184)** |

Net across every invariant: **−2,544 warns.** All risers are `warn`; **zero error-severity**
violations were introduced.

## 🔴 Why it does NOT ship

1. **It breaks three PUBLISHED plans on the website.** `marketingPlanShape.test.ts` fails for
   `5k-12-week`, `10k-12-week` and `sub-25-5k-plan`: *"I4 w3: recovery week only 6% below w2
   (18 → 17 km); band is 20–35%"*. Moving a deload changes the week it steps back **from**, so a
   placement that satisfies §119 can stop being a real reduction. This is a live surface.
2. **Two invariants rise by ~1,100 each.** A deload moving changes every week-on-week delta, so
   more weeks clear §2's cap at delivery. Net is favourable; "no negative impact to plans at all"
   is not met.
3. **The half-marathon half is UNREACHABLE within ratified doctrine, and this is the real finding.**
   The HM shape is base 1–5, build 6–10, peak 11–13 at the **masters** cadence of 3. A run is then
   **exactly 2** (`maxRun == MIN == 2`), so the only legal second placement is **week 6 — a phase's
   first week**, which §87 excludes. Closing HM requires allowing a **3-week** masters loading
   block, which is precisely what **Sims's §87 rule 3 forbids.** That is a board question, not an
   implementation one.
4. It also moves a golden-plan snapshot and the `§95 STANDARD (freq 4)` placement assertion, both
   of which currently pin `[2,6,10]` — i.e. **the defect is pinned by a test.** Legitimate to
   update, but only alongside a ruling.

## What the next attempt needs

- 🏃 **A Coaching Board ruling on the masters trade:** may a masters loading block run 3 weeks to
  buy §119's opening block? Without it, **52.1% of half marathons cannot be fixed**, and the
  item's falsifier (*"the warn rate must go to ~0, not to a residual"*) **cannot be met.**
- A deload-depth reconciliation, so a moved deload is still a 20–35% reduction against its **new**
  preceding week. This is `DELOAD-BADGE-TRUTH-01`'s arithmetic — so the prerequisite ordering the
  board set is **correct but insufficient**: the two have to land **together**, not in sequence.
- The published-plan snapshots regenerated deliberately, as a declared move.

⚠️ **The sequencing amendment needs revisiting.** The board ruled placement lands FIRST because
moving deloads changes which transitions invert. Measured: placement **on its own** makes three
published plans' deload depth illegal. Placement first is right; placement **alone** is not
shippable.


---

# Coaching Board sitting 2 — the masters question, answered

**2026-10-05.** Asked: may a masters loading block run THREE weeks where that is the only way to
give the plan a §119-compliant opening block?

## ⚖️ INCORRECT — a veto, and a RE-AFFIRMATION rather than a new one

🔴 **§95 had already ruled it, for this cohort, from the seat whose rule I came to relax.** §95
governs *position 2* and §119 the *opening block*, so they are different defects — but the geometry,
the cohort and the alternative are identical:

> *"On masters plans the rule usually cannot be satisfied, and that is recorded rather than worked
> around."* Unsatisfiable on **1,944 of 3,726 masters plans (52.2%)** and **0 of 3,726 standard**.
> **D-21 applies.**
>
> ⚕️ **Sims: "masters are the population with the slowest bone and connective recovery, and the
> alternatives (a longer loading block, or back-to-back deloads) both take real recovery away from
> exactly them."**

A longer loading block is **named and refused there**. A corpus count is not the outcome evidence
that would reopen it.

⚠️ **AND I NEARLY MIS-CITED IT, IN MY OWN FAVOUR OF CLOSING THE QUESTION.** §95's **52.2%** and my
**52.1%** matched to a decimal, and I was about to report the question already-settled on that
basis. They are **two different denominators** — *masters plans* against *HM plans*. The split
disproved it: §119's defect is **masters 28.0% / standard 23.6%**, present in both, where §95's was
**52.2% / 0.0%**. **The precedent governs the RESIDUAL, not the original defect.** Two near-identical
percentages from different populations is the same trap as every other denominator error in this
repo, and matching to one decimal place is what made it convincing.

## The residual is ONE CELL, and that is what makes the carve-out right

Measured with the search applied, by cadence x distance:

| cohort | residual |
|---|---|
| **masters x half marathon** | **99.1%** (5,136 / 5,184) |
| masters x marathon | 3.3% |
| masters x 5K / 10K | 2.8% |
| standard x half marathon | 5.1% |
| standard x marathon | 3.5% |
| standard x 5K / 10K | 2.8% |

**That one cell is 82% of the entire 6,268 residual.** The search's whole gain was the MARATHON
(49.9% → 3.4%); HM was never improved, because masters HM was always ~99% and standard HM was
already ~5%.

🎯 **McMillan, on the 99.1%:** *"this is not an edge case that slipped through — for a masters
half-marathon runner it is what the plan ALWAYS does. But 'recorded rather than worked around' has
to mean recorded TO THE RUNNER, not only in a document."*
🩹 **Willy:** *"at cadence 3 the runner is already on the shortest recovery interval we prescribe
because of their age. Extending the block to 3 weeks removes the one thing that cadence exists to
deliver."*
⚕️ **Sims:** *"99.1% is far worse than the 52.2% I ruled on, and worse in the direction of my own
concern. The remedy is not a longer block; it is that §119 stops pretending this cohort has a legal
placement."*
🏃 **Hutchinson:** the §2 Am. 2 freeze is his and is scoped to §2's **ramp** predicate, **not** §87's
placement rules — so it does **not** block this. §95's precedent does.

## ✅ CORRECT, separately: §119 gains §95's masters carve-out under D-21

A rule that cannot be honoured is a defect in the rule. For the masters cadence §119 becomes a
**preference**, the residual carries an honesty flag as §95's `deload_position2_yielded` does, and
McMillan's condition binds: **the runner is told.**

🔴 **THIS OVERTURNS THE ITEM'S OWN ACCEPTANCE CRITERION.** `DELOAD-PLAN-OPENING-01` says *"the warn
rate must go to ~0, not to a residual."* **That is unachievable and now ratified as such.** Restated:
**~0 outside the declared masters set.**

### Artifacts — and why they do NOT land yet
1. **Principle** — §119 Amendment 1 (masters preference + honesty flag, mirroring §95).
2. **Numeric** — none new; keys on the existing `MASTERS_AGE_THRESHOLD` (45).
3. **Invariant** — `INV-PLAN-MIN-LOADING-BLOCK` reads the flag for the masters set.

⚠️ Knowing *"no legal placement exists"* **requires the search**, and the search cannot ship alone
(three published plans' deload depth). **All of it lands with the combined placement +
`DELOAD-BADGE-TRUTH-01` depth ship.**


---

# Third attempt, 2026-10-06 — the search was rebuilt, (b) was implemented, and (b) IS NOT IMPLEMENTABLE AS RULED

**Not shipped. Reverted. This section exists so a fourth attempt starts from the blocker rather than
from the build.**

## The premise was re-measured first, and it has NOT gone stale

Three ships landed between 2026-10-05 and this attempt. On today's engine, 5,664 cohort plans
(stride 7 over 41,472):

| | 2026-10-05 | 2026-10-06 |
|---|---|---|
| `INV-PLAN-MIN-LOADING-BLOCK`, plans firing | 25.8% | **25.8%** |
| week the firing lands on | week 2, 100.0% | **week 2, 100.0%** |
| 5K / 10K | 2.8% / 2.8% | **2.8% / 2.8%** |
| **HM / marathon** | 52.1% / 49.9% | **52.1% / 50.0%** |

## The search reproduces the recorded result exactly

| invariant (plans firing) | legacy | + search |
|---|---|---|
| `INV-PLAN-MIN-LOADING-BLOCK` | 25.8% | **15.8%** |
| — marathon | 50.0% | **3.4%** |
| — half marathon | 52.1% | **52.1% (unmoved)** |
| `INV-PLAN-DELOAD-IS-A-REDUCTION` | 6.9% | 5.3% |
| `INV-PLAN-DELIVERED-RAMP` | 19.8% | 21.6% |
| `INV-PLAN-HEADER-PACE-MATCHES-WORK` | 8.0% | 10.9% |

✅ **Both ratified bounds hold, measured rather than asserted.** Across 5,663 plans served by both
builds: **deload count rose 0 times and fell 0 times** (🩹 Willy), and delivered peak moved on
**130 plans of 5,663** — 50 up, 80 down, mean **41.54 → 41.53 km**. Worst single drop −5.0 km
(32 → 27, −15.6%); largest rise +3.0 km.

⚠️ **ONE RUNNER LOSES A PLAN, and it is §111 working rather than a regression.** Exactly one case
of 5,925 flips served → refused: marathon, experienced, finish, 20 km/wk (effective 14), age 35.
`minBaseKm = ceil(deliveredPeakKm / MAX_BASE_BUILD_RATIO)`, and this plan's **delivered** peak rose
enough to take `minBaseKm` from 14 to 15 — one kilometre above the runner's effective base, so §111
refuses a 4:1 build. The refusal is §44-compliant and the runner is served a §118 plan.

## Fix (b) was implemented and it WORKS for the defect it was written for

Implemented as `withholdUntrueDeloadBadges` in `weekVolume.ts` — a pass over the FINISHED weeks,
reading `trainingKm` (i.e. the stamped `weekly_km`), with the board's own (a)/(b) discriminator:
withhold only where **the curve cut >= 20% and delivery did not**, so the arithmetic defect (a)
stays visible.

✅ It resolved **all three** published-plan `I4` findings — `10k-12-week` went fully clean.

⚠️ **AND THE FIRST CUT OF IT WAS THE "SECOND READER" FAULT, SELF-INFLICTED.** The first version did
the comparison inline in the week loop from `sumWeeklyKm(sessions, pace)`, and disagreed with `I4`
— which reads `trainingKm` — **about the size of the same week** (37.0 km against 32 km), in a
module whose header exists to stop exactly that. Moving it onto the finished weeks made producer and
checker read one value by construction. **The divergence was found by printing both numbers, not by
re-reading the code.**

## 🔴 WHY IT DOES NOT SHIP: (b) AS RULED CONTRADICTS THREE ERROR-SEVERITY INVARIANTS

Withdrawing the recovery badge sets `type` away from `'deload'`, and **`type: 'deload'` is
load-bearing for three ratified rules.** Measured on `10k-12-week`:

| invariant | what fires |
|---|---|
| **`INV-PLAN-DELOAD-PLACEMENT` (§87)** | *"Plan has 1 recovery weeks but the §3 cadence calls for at least 2. **Placement may SHIFT a deload, never remove one**"* — `recovery_weeks_may_decrease: false`. 🩹 **This is Willy's own bound, and the badge withdrawal breaks it.** |
| **`INV-PLAN-QUALITY-EXPECTED` (§1/§6/§8)** | the demoted week is now a BUILD week and owes a quality session it was never built with |
| **`INV-PLAN-STRIDES-PRESENT` (§28)** | §28 requires strides on every non-deload, non-race week from week 3 |

**One root cause: a demoted week is structurally still a recovery week, so every rule keyed on
`type !== 'deload'` begins to apply to it.** The ruling's phrase *"fix the BADGE, not the volume"*
does not distinguish `Week['badge']` (display) from `Week['type']` (structure), and the engine's
`type`/`badge` split makes that distinction decisive:

- withdraw **`type`** → §87, §1 and §28 all fire (measured above);
- withdraw **`badge`** only → those three are untouched, but `planShapeInvariants`'s `isDeload`
  reads **`type`**, so `I4` still gates and the published plans still fail. Changing the checker to
  read `badge` instead would be moving the goalpost to let the change pass.

## What a fourth attempt needs — and it is a BOARD question, not an implementation one

🏃 **The board must choose between three remedies, and all three are doctrine:**

1. **A third week state.** A week that is neither a loading week nor a recovery week — prescribed as
   reduced, delivering flat because the floors refused the cut. §87 counts it, §1 and §28 exempt it,
   `I4` records it. This is the honest shape but it is a new structural concept.
2. **`I4`'s too-shallow arm becomes ADVISORY where the cause is the floors**, exactly as its
   too-DEEP arm already is (*"§3's 70% is applied to the volume CURVE; the DELIVERED deload lands
   lower because session floors bite harder on a small week"*). Minimal, symmetric with ratified
   precedent, and changes nothing the runner sees — which is also its weakness: §34's honesty
   obligation would go unmet.
3. **Withdraw the display badge only**, and accept that `I4` must then read `badge`. Needs the board
   to say which field carries the §34 claim.

⚠️ **A SEPARATE BLOCKER SURVIVES ALL THREE, and it belongs to the SEARCH, not to (b).** With the
search applied and (b) reverted, two published plans carry **`I6`**: *"longest easy run fell
5.5 → 4 km (−27%) between loading weeks; cap is −20%"* (`5k-12-week` w5, `sub-25-5k-plan` w5). The
4 km figure is §9's easy-run FLOOR. Attributed by stashing (b) and re-running: **`I6` is present
with the search alone and (b) neither causes nor fixes it.** Moving a deload changes the curve the
following weeks are sized from, and on a small plan the easy run lands on its floor.

⚠️ **And §119 Amendment 1 still cannot land.** Its artifacts need `deloadPlacementFeasible` (written
in this attempt, reverted with the rest) AND a surface, because 🎯 McMillan's condition is binding:
*"'recorded rather than worked around' has to mean recorded TO THE RUNNER, not only in a document."*
**What the runner is told is the Design Board's**, so the combined ship is cross-board.

## Honest summary of where this stands after three attempts

- The **search** is correct, twice-measured, and bounded by both ratified constraints. It is not the
  blocker and never was.
- **(b) works for `I4` and breaks §87, §1 and §28.** That is new information: the previous two
  attempts had not implemented it.
- The remaining blockers are **one board choice** (which field carries §34's claim, or a third
  state), **one unratified side effect** (`I6`, from placement), and **one design surface**.
- ⛔ **Do not ship the search alone.** Three published marketing plans fail on `I4`, and that was
  true on 2026-10-05 and is true today.
