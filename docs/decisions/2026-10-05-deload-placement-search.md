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
