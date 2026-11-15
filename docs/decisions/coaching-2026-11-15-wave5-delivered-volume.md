# Coaching Board — Wave 5, the delivered-volume sitting

**Date:** 2026-11-15 · **Chair:** Hutchinson · **Seats:** Seiler, McMillan, Willy, Sims
(Blagrove silent — no strength rule in scope)

**Items:** `ENGINE-BASEBUILD-UNVALIDATED-01` (A) · `S9-QUALITY-FLOOR-REACH-01` (B) ·
`ROUND-WARNS-UNRULED-01` (C)
**Not raised:** `DELIVERED-TAIL-LEVERS-01`, `LONG-RUN-CAP-INJURY-VALUE-01` — see § Not raised.

**Trigger:** A is a soft trigger that QUALIFIES (it changes what a base-build runner is
prescribed). B is a soft trigger that qualifies on paths (2) and (3). C is no trigger at all —
it weighs warns against principles already ratified and changes nothing by itself.

**Measurement in front of the board:** `npm run review:coaching`, all seven steps, run today.
Envelope 94.6% (target 90–95%), fitness ok, no measured rate moved.

---

## 🔴 Before any seat speaks: THE POPULATION IN THE ITEM WAS WRONG, AND SO WAS MINE

`ENGINE-BASEBUILD-UNVALIDATED-01` states **1,730 rows reach the branch, 1,730 of 1,730 carry an
error, 10,084 violations.** I reproduced it to within six rows (1,736 / 1,732 / 10,088) and then
found that **both figures measure a population the product cannot route there.**

A runner can only send `accept_base_build` after `runEngine` has **offered** them a base build.
Measured through `runEngine` itself rather than through `getRunningApplies` plus a direct
generator call:

| | rows |
|---|---|
| corpus | 47,668 |
| refused | 1,732 |
| …of which `warn_unacknowledged` (§44 runway warning the runner simply acknowledges) | **1,728** |
| …of which `long_run_readiness` (§113) | 4 |
| **OFFERED a base build** | **4** |
| plan returned on accept | 4 |
| plans with ≥1 error | **4 · 8 violations, steps +1.6 to +1.7 km against a 1.5 cap** |

The `get_running` offer is attached to §113's `LongRunReadinessError` (§118 Am. 4) and to §111's
branch. It is **not** attached to `DaysAvailableError` — and 1,728 of the 1,732 refusals in the
corpus are not refusals at all, they are the §44 warning. So the 10,088 violations, the 88.6 km
session and the 266 km week all sit on rows nobody is offered a base build for.

⚠️ **This is the third population error in two days and the second one of mine.** The item's
figure was taken by forcing `generateGetRunningPlan` over rows selected by `getRunningApplies`,
which is a *capability* predicate, not a *routing* one. **Measure through the producer the product
calls** — `runEngine` — not through the gate the producer happens to consult.

### What survives the correction, and it is not nothing

**There is a second door, and it asks no refusal question by design.**
`BASEBUILD-ADJUST-REBUILD-01` moved the branch out of the `catch` so a runner who already HAS a
base-build plan and edits it keeps getting one. `DashboardClient.runModifyPreview` sends
`accept_base_build: true` with **whatever volume the runner edited**, and `declaredVolumeEdit`
treats an edited volume as a fresh declaration. `runEngine:329` then honours it against
`getRunningApplies`, which is `effectiveStartKm(input) > 0` — **no upper bound.**

Measured on the space that door permits (every row where a base build applies):

| | |
|---|---|
| rows | 47,662 |
| with ≥1 error-severity violation | **38,564 (80.9%)**, 163,068 violations |
| every run in every week IDENTICAL length — no long run, no easy run | **99.5%** |
| peak weekly volume / declared volume | **3.78–3.80× for the whole population** |
| longest SINGLE session, median / p90 | **44.3 km / 88.6 km** |
| plans prescribing a session longer than THE RACE DISTANCE | **1,296 (74.7%)** |
| plans prescribing a session over 2× the runner's longest recent run | **1,736 (100%)** |

The worst, read week by week: **marathon, declares 70 km/week, longest recent run 28 km, 3 days** →
a 15-week block running **69.9 → 265.8 km/week**, every week three identical runs, week 15 three
runs of **88.6 km each**.

**📐 LIVE EXPOSURE IS ZERO, and it is checked, not assumed.** Production holds 43 plans, 4 of them
base builds. All four start at **5–10 km/week** — inside §118's design cohort — and peak at
12–37.6 km/week with a longest session of 5.5–9.4 km. The 3.76× multiplier is visible on both
15-week plans, which is the curve behaving exactly as ratified. **Nobody has been hurt. The gap is
latent and the door to it is open.**

---

## 🔍 Conflict scan — amendments, not headings

**§2 Amendment 2 (2026-09-20, `HM-WEEK1-PERRUN-01`).** This is where
`WEEK1_PER_RUN_STEP_MAX_KM = 1.5` is ratified, and it ratifies it as **a week-1 screen**: *"the
ratio arm of the **week-1 rule** fires only where the increase per run exceeds 1.5 km"*, *"enforced
by `planQuality`'s `WEEK1-LEAP` predicate"*. It answers **one** question: how much larger may week
1's per-run load be than the volume the runner already runs?

🔴 **`validateBaseBuildBlock` reads that constant as a PER-WEEK ramp cap, applied between every
consecutive build week for the whole block.** Those are different rules sharing a constant whose
name says `WEEK1`. Checked against Willy's own illustration in §116 binding amendment 2 — *"at
8 km/wk over 4 days that is 2 km a run; at 18 it is 4.5"* — his cohort climbs per-run from 2.0 to
4.5 km across eleven weeks, **+0.25 km a week**, nowhere near 1.5. The invariant does not fire on
the cohort §116 ratified it for. It fires on runners §116 never considered.

**§2 Amendment 2 also carries Hutchinson's freeze:** *"this predicate is frozen after this
amendment until we hold adherence or injury data. Any further relaxation needs outcome evidence,
not another corpus measurement."* **Any move that loosens 1.5 is out of scope today.** The board
does not touch it.

**§116 binding amendment 2 (Willy)** delegates the per-run step to §2 Am. 2 and names the hazard as
**the per-run doubling** — *"the per-run doubling is the load event, not the weekly total."* A
doubling and a flat +1.5 km are not the same predicate.

🔴 **AND THE TWO RULES ARE MATHEMATICALLY INCOMPATIBLE ABOVE A 15 KM RUN.** §2's ramp is
`MAX_WEEKLY_VOLUME_INCREASE_PCT = 10`; §2 Am. 2's step is an ABSOLUTE 1.5 km.
`1.5 / 0.10 = 15`, so any §2-compliant ramp breaches the absolute step the moment the longest run
passes 15 km, by arithmetic and regardless of the runner.

**Measured, 28,512 violations sampled:** `prevLongest > 15 km` in **28,512 of 28,512 (100%)**,
smallest 16.5 km, and **every step is 9.7–10.3% of the prior run — §2's own ratified rate.**
**Not one violation in the corpus is a load event.** The arm fires on nothing but correct ramping,
and it is unsatisfiable by any compliant plan above 15 km.

**§45** already ratifies a per-run growth cap and ratifies it as a **ratio**:
`LONG_RUN_PROGRESSION_CAP_PCT = 20` (with `LONG_RUN_PROGRESSION_CAP_ABS_KM = 5` as the greater-of
companion). A ratio is also what Willy's own words describe — *the per-run doubling*.

**§118's own text refuses a target**: *"DERIVED FROM THE RUNWAY, NOT A FIXED TARGET, and that is the
point… imposing a target would invent a deadline the runner does not have."* **A target is already
ruled against. Do not re-propose one.**

**§118's ceiling is a RATIO and it is honoured.** `GET_RUNNING_MAX_WEEKS: 15` is bounded *"because
16 weeks of §2's 10% compounds past §111's `MAX_BASE_BUILD_RATIO` of 4.0"*, with Willy recorded:
*"I will not have two total-build ceilings in one constitution."* Measured 3.78–3.80× against a cap
of 4.0 — **compliant. There is no ceiling defect and the board may not add a second ceiling.**

**§111's door is a SCOPE gate and it is computable from the input alone** —
`effectiveStartKm < ceil(peak / MAX_BASE_BUILD_RATIO)`, 13 km/week for a beginner marathon
(recorded at `generationConfig.ts:1546`). `getDistanceConfig(race_km).peakKmByLevel[level]` makes
it derivable without building a plan.

**§106** (`peakKmByLevel`, the peak ceiling) **does not reach a base-build block** — it governs race
plans. **§9**'s long-vs-easy ratio and **§52**'s long run do not reach it either, which is why 99.5%
of edit-reachable blocks have no long run at all.

**No conflict** with §12, §3, §44, §117 or §113.

For Part B: **§9 Amendment (2026-10-27, `S9-QUALITY-MINUTES-01`)** — *"a quality or
secondary-quality session meets §9's floor at its km floor **OR** this many minutes in total"*,
`QUALITY_FLOOR_MINS: 35`. ⚠️ **The amendment says "or"; the SIZING says "and".** The checker honours
the disjunction; the distance budget lifts to 5 km regardless. **§8/D-21's "the floor beats the
ceiling" is explicitly amended by it** — *"once a session is this long the dose band governs."*
Touches **§19 Am. 2** (`REP_ROW_MIN_REPS`) and **§85** (the dose band) as downstream.

---

## 🏃 Alex Hutchinson (Chair)

On A: the correction matters more than the finding. We were handed *"100% of the plans built for
people who cannot yet run carry an error"* and the true reading is *"four plans, eight marginal
violations, and one wide-open door nobody has walked through."* Those call for different work and
I would have funded the wrong one.

What I will not accept is the framing that the invariant is wrong because it fires outside its
ratified cohort. It is firing on a plan that prescribes **three 88.6 km runs in a week to a runner
whose longest run is 28 km**. A rule that catches that by accident is still the only rule that
caught it. **Do not touch the predicate; close the door it is shouting through.**

On the per-run step reused as a per-week cap: that is a real seam and it is not today's. The steps
on the four reachable plans are +1.6 and +1.7 against 1.5 — the rule doing its job at the margin.
Record the seam; do not relitigate 1.5 under a freeze I placed myself.

On B(2): the amendment I ratified in October says **or**. The engine implements **and**. That is a
gap between documented intent and behaviour, which is ordinarily a defect fix — except the fix
makes a quarter of all plans' quality sessions shorter, so it is a prescription change wearing a
defect's clothes. It needs a measurement of what the runner loses, not just what the rule says.

On C: no seat should spend this sitting re-deriving §7's wording, §52 Am. 1's exemption or §94
Am. 2's freeze. I placed the last of those. The question is narrower and I will answer it.

## 📊 Stephen Seiler

On A: the block has **no quality at all** — §116 amendment 6 is mine and it is honoured. No
objection on distribution.

The thing I will name is the one nobody has: **99.5% of edit-reachable blocks give every run the
same length.** That is not a distribution problem, it is the absence of a distribution. A week of
three identical 23 km runs is not 80/20 and it is not 100/0 — it has no shape. §1 counts sessions,
so it cannot see this, and that is correct; §1 is not the rule being broken. But do not describe
this plan as "all easy, per amendment 6" and feel covered. All easy and all identical are different
things.

On B: minutes are the right unit for a floor and km is the wrong one, which is what October
decided. 13,092 sessions sized by the km floor while already past the minute floor means **the
amendment is live in the checker and dead in the producer.** That is the decorative-config shape,
one layer in.

On C: `INV-PLAN-LR-MAX-WEEKLY-PCT`, 23 firings across **two** runners, is not a plan-wide finding
and should never be read as one. E5 is three days a week with a 30-minute weekday cap: the long run
is 61% of the week because there is nowhere else for volume to go. That is the input, not a defect.

## 🎯 Greg McMillan

On A: I will say the plain thing. **Three runs of 88.6 km.** No coach alive writes that, and the
reason the engine can is that it was asked a question it was never designed for — *"build this
person up"* — about someone who does not need building up.

And the shape, even at sane volumes, is wrong for a Tuesday. Three identical runs is not how anyone
trains. §116's cohort at 8 km/week over 4 days gets four 2 km runs, which is fine because at that
volume everything is the same run. At 20 km/week over 4 days it is four 5 km runs, and by then one
of them should be longer than the others. **The block has no long run and nobody noticed because
the cohort it was built for is too small for a long run to mean anything.**

I support the scope gate and I want it stated the right way round: a base build is for a runner
whose volume is **too low for their race**. If an edit lifts them above that, the honest answer is
not a smaller base build, it is *"you don't need this any more."*

On C: `INV-PLAN-LARGEST-SESSIONS-SPACED`, 26 firings across 13 of 25 cases, says in its own message
*"likely forced by available days."* It is. A runner with three open days cannot put their two
biggest sessions two days apart. **That is the most honest warn in the set and it should stay a
warn forever.** If we ever make it an error we will refuse half our own demographic.

## 🩹 Rich Willy

On A. The arithmetic first, because it changes which of us is wrong.

**My amendment is being enforced by a rule I did not ratify, and that rule cannot be satisfied.**
I said the per-run **doubling** is the load event. §2 Am. 2's 1.5 km is an absolute, ratified as a
week-1 screen, and `1.5 / 0.10 = 15` — so above a 15 km run, §2's own 10% ramp breaches it every
week, forever. 28,512 of 28,512 violations sit above that line and every step is 9.7–10.3%.
**Not one of them is a load event. They are §2 working.** An invariant that fires only on
compliance is worse than no invariant: it is 10,088 units of noise standing where a real guard
should be, and it is why nobody looked at the plans underneath.

So fix it with a number this board already ratified. **§45 is `LONG_RUN_PROGRESSION_CAP_PCT = 20`**
— a ratio, for the growth of a single run, week on week. A 10% step is inside it; a doubling is not.
That is my amendment, correctly encoded, using an existing constant. **I am not relaxing §2 Am. 2 —
I am not touching it. It keeps its week-1 job.**

**And now the part that was hidden behind the noise, which is the real finding.** With the step arm
reading a ratio, these pass:

- a single session of **88.6 km**, three times in one week, to a runner whose longest run is 28 km
- a block ending at **266 km/week** off a declared 70
- **74.7%** of edit-reachable blocks prescribing a session **longer than the race**
- **100%** prescribing a session over **twice** the runner's longest recent run

Every one of those is a +10% step. **The hazard was never the step. It is the absolute size, and
nothing in this constitution bounds it for this plan kind** — §52 and §9 cap the long run as a
share, and a block with no long run has nothing for them to cap. §106's peak band governs race
plans and does not reach here.

**I will not have a second total-build RATIO ceiling** and I repeat it: 3.78 against 4.0 is my
ceiling, working. **§106 is not a second ceiling.** It is this constitution's existing absolute
peak band, and it should reach a block that currently escapes it. One number, used where it
already applies.

Conditional, and binding: **no runner currently holding a base build may be affected.** All four
live plans start at 5–10 km/week and peak at 12–37.6 — every one far below every §106 band. Verify
it before it ships.

On C: `INV-PLAN-INJURY-CAP-DELIVERED` (1 firing) and `INV-PLAN-BOUNCEBACK-BOUNDED` (2) are mine and
both messages name `DELOAD-INVERSION-01` as the open lever. They are warns doing their job —
reporting a residual we ratified. Leave them.

`INV-PLAN-RUNWALK-SHORTDIST-SCOPE` (2 firings) is the half-marathon band §117 Am. 8 left open and
its message says so. **That one is a plan I would not hand over** — a beginner going for 21.1 km
off a 5 km longest run, with no run-walk prescription, because the amendment named the 5K and 10K
and stopped. It is already filed as `SHORTDIST-RUNWALK-SCOPE-01`. It should be the next thing this
board builds, and it is not this sitting.

## ⚕️ Stacy Sims

On A: the cohort reaching this block is novice, and novice skews female in this product. A plan that
quadruples weekly volume with no energy-availability note is the RED-S setup I keep naming. §116
amendment 4 is mine — *"a silent ramp is not a fuelled ramp"* — and I want it confirmed that the
fuelling note survives on a block reached through the **edit** door, not only the offer door. If it
is attached at the offer, it is missing on precisely the path this sitting is about.

On the identical-runs finding: for a peri- or post-menopausal runner three identical hard-ish runs
a week is worse than one longer and two shorter, because the recovery cost does not distribute. I
support McMillan.

On C: `INV-PLAN-MIN-LOADING-BLOCK` (§119, 1 firing, E3 masters 58 with a knee history) — *"week 2 is
a recovery week after only 1 loading week."* One loading week then a deload, for a 58-year-old with
a knee history, is a plan that teaches nothing and recovers from nothing. **Low prevalence, wrong
runner.** I want it counted, not ruled correct by rarity.

## 💪 Richard Blagrove

No strength rule in scope. No objection from this seat.

---

## ⚡ Recorded disagreements

**1. Willy vs the record, on whether the scope gate is a second ceiling.** Willy's ratified words
are *"I will not have two total-build ceilings in one constitution"*, and a reader could fairly call
a scope bound on `getRunningApplies` a second ceiling. Willy's position: §111's door is a gate on
**eligibility**, not a cap on the **block**, and reusing one number on two doors is the opposite of
two ceilings. **The chair accepts Willy's reading, and records the objection so a future sitting can
reverse it without rediscovering it.** What would change his mind: evidence that the gate refuses a
runner who is in cohort.

**2. Sims vs the chair, on §119's one firing.** Sims will not have prevalence used as a ruling.
Hutchinson's position is that one firing on a known-open lever is a warn working. **Unresolved and
recorded.** It would be settled by measuring how many *live* masters-with-injury plans open on a
deload — which is 1 plan in production, so it cannot be settled today.

---

## ⚖️ Rulings

### Part A — `ENGINE-BASEBUILD-UNVALIDATED-01`: **CORRECT WITH AMENDMENT**

**The item asked whether the ramp is wrong. It is not. The INVARIANT is wrong, and it was hiding a
different and worse defect.**

`INV-PLAN-ONRAMP-PER-RUN-STEP`'s build-week arm enforces §116 Am. 2 with §2 Am. 2's **absolute**
1.5 km, which was ratified as a week-1 screen. Above a 15 km run that is unsatisfiable by any
§2-compliant plan — 28,512 of 28,512 violations lie above the line, every step 9.7–10.3%. **Zero of
the 10,088 "violations" is a load event.**

**The amendment, in two parts.**

1. **The per-run step arm becomes a RATIO, at §45's ratified `LONG_RUN_PROGRESSION_CAP_PCT` (20%).**
   This is Willy's *doubling* correctly encoded, using a constant this board already ratified for
   the growth of a single run. §2 Am. 2 is **untouched** and keeps its week-1 job; its freeze is not
   engaged, because nothing here relaxes that predicate.
2. **§106's peak band reaches the base-build block.** The block's delivered peak weekly volume may
   not exceed `peakKmByLevel` for the runner's race. This is the absolute hazard the noise was
   hiding: 266 km weeks, 88.6 km sessions, 74.7% of edit-reachable blocks prescribing a run longer
   than the race. **Not a second ceiling** — §111's ratio ceiling (3.78 vs 4.0) is untouched and
   Willy's refusal of a second one stands; §106 is an existing absolute band being allowed to reach
   a plan kind that escapes it.

🔴 **AND THIS CONFLICT WAS FILED IN SEPTEMBER, BY THE INVARIANT'S OWN REGISTRY ROW, WHICH NAMED THE
BAND IT WOULD BECOME REACHABLE IN.** `ONRAMP-STEP-UNITS-01` (2026-09-23) records: *"Above
`weekly > runs × 15` km, §2 and §116 Am.2 CANNOT BOTH HOLD (measured: 3 days breaches above 45,
4 days above 60, every case)"*, filed unfixed because *"unreachable by any runner §118 serves today
(0 of 522)"*, and *"reachable at 15–20 km/week because §118 has no volume target"*. **The four
runners offered a base build in today's corpus sit at 20 km/week.** The prediction was right and
the reason for deferring it has expired.

⚠️ **That row also says *"do not resolve by raising the cap or relaxing §2 — Willy owns both"*, and
the board read it before ruling.** Neither was done: `WEEK1_PER_RUN_STEP_MAX_KM` is unchanged at 1.5
and `MAX_WEEKLY_VOLUME_INCREASE_PCT` at 10. What changed is the **unit of the bound**, which is the
third option the row names itself — *"a cap measured in different units from the bound it must
satisfy is not a cap."*

⚠️ **State it plainly: this LOOSENS the check** above a 7.5 km run (20% of 17 km is +3.4 km where
1.5 was allowed). The board rules it on the evidence that **not one of the 28,512 was a load
event**, and on §45 being this board's own ratified per-run cap.

**Then, and only then, `validateBaseBuildBlock` is wired into the `base_build` branch**, which is
what ADR-020's `INV-PLAN-SINGLE-CONSTRUCTION` has always required. Wiring it first would have made
the noise fatal in dev and test, which is exactly why the item said the ungated half could not ship
alone — and the item was right for the wrong reason.

❌ **Not a target for the block** — §118's own text refuses one.
❌ **Not a change to `WEEK1_PER_RUN_STEP_MAX_KM`** — §2 Am. 2's freeze stands and is not engaged.
❌ **Not a new constant anywhere** — §45's percentage and §106's band both already exist.
❌ **Not a scope bound on `getRunningApplies`.** The chair considered one and **rejected it on the
measurement**: §111's door is a WEEKLY-VOLUME gate, and the four runners actually offered a base
build today are refused by **§113, for their LONG RUN** — 20 km/week with a longest run of 0 km.
A volume door would refuse all four and hand them nothing, reversing
`NO-RUNNER-TURNED-AWAY-01`. **Right-shaped gate, wrong question.**

**Willy's binding condition:** no runner currently holding a base build is affected. All four live
plans start at 5–10 km/week and peak at 12–37.6 km, below every §106 band. Verified before ship.

**Recorded seams, not fixed here:**
- 🔻 **The block has NO LONG RUN**, so §9, §52 and §106-as-written are all about a session it does
  not contain. **99.5% of edit-reachable blocks give every run in every week identical length.**
  Seiler: *"all easy and all identical are different things."* McMillan and Sims both want a long
  run. **Filed; it is a prescription change needing its own measurement.**
- 🔻 `WEEK1_PER_RUN_STEP_MAX_KM` is ratified as a week-1 screen and was read as a per-week cap. The
  misreading is fixed; **whether any other rule reads a `WEEK1_` constant per-week is not checked.**
- 🔻 Sims's §116 Am. 4 fuelling note on the **edit** door — confirm or file.

### Part B — `S9-QUALITY-FLOOR-REACH-01`

**(1) Progressive tempo — INSUFFICIENT EVIDENCE, no action.** 0 sessions and 0 plans breach either
floor today. Growing it changed 177 served plans with no measured benefit. The `rca1026Gates` DEBT
entry stays.

**(2) The quality distance budget — INSUFFICIENT EVIDENCE.** The §9 amendment says **or** and the
sizing implements **and**, on 13,092 sessions across 26.1% of plans. That is a real contradiction
between a ratified amendment and the producer, and the chair will not rule it either way on a count
alone: correcting it makes a quarter of all plans' quality sessions **shorter**, and nothing in this
packet says what the runner loses. **What would settle it:** the delivered duration and work-minute
distribution of those 13,092 sessions before and after, plus `measure:fitness`. One prototype,
measured, next sitting.

**(3) The secondary-quality floor — INSUFFICIENT EVIDENCE, no action. 🔴 THE ITEM'S MECHANISM IS
FALSE, AND THE FIX FOR IT WAS BUILT AND REVERTED TODAY.**

The item says *"secondary quality grows toward 5 km, not its own 4 km floor"*, and the code reads
that way: `makeQualitySession` hands `continuousThresholdPlan` the PRIMARY's
`MIN_SESSION_DISTANCE_KM.quality` (5 km) unconditionally at `ruleEngine.ts:1591`, while the budget
at `:3848` correctly uses `secondary_quality` (4 km). **I made the growth loop read the session's
own floor. It changed nothing: still 1,600 of 1,600 at or above 5 km, still 0 in [4,5). Reverted.**

**Measured, and it settles the mechanism:** in all 1,600 two-quality weeks the SMALLER quality
session is **7.0–11.5 km (median 9.0)** and the larger is **7.5–14.0 km (median 10.0)**, so the
budget — `SECONDARY_QUALITY_PCT_OF_PRIMARY` (80%) of the primary — is **6.0 km at its smallest.
In 0 of 1,600 weeks does it fall below even the 5 km primary floor.**

So nothing grows these sessions and no floor binds them. **A two-quality week only occurs at
volumes where 80% of the primary budget is already 6 km or more.** `secondary_quality: 4` is
unreachable config — *read* by the budget, so `configConsumer` counts it consumed, and governing a
band no served plan enters.

⚠️ **This is a THIRD category and §25 Amendment 1's warning applies directly:** *"an unread number
is not automatically a WRONG number… 'read by nothing' is evidence a CONSUMER is missing, not that
the VALUE is junk."* This value is read, is correct, and is unreachable. **The board does not delete
it and does not "fix" a precedence bug that is not there.** It is recorded as a declared limit.

🔻 **The real residual, filed:** the precedence at `ruleEngine.ts:1591` IS wrong in principle — a
secondary session held to the primary's floor — and today it is latent because the band never
occurs. If any future change lets a two-quality week happen at lower volume, it becomes live
silently. **`S9-SECONDARY-FLOOR-PRECEDENCE-01`.**

### Part C — `ROUND-WARNS-UNRULED-01`: **weighed. One plan we would not hand over.**

76 firings, 10 codes, 25 cases, 0 errors. Of the ten:

| Code | Verdict |
|---|---|
| `INV-PLAN-LARGEST-SESSIONS-SPACED` (§7) 26/13 | **Warn doing its job, permanently.** Forced by available days. McMillan: making it an error would refuse half the demographic |
| `INV-PLAN-LR-MAX-WEEKLY-PCT` (§52, §114) 23/2 | **Warn doing its job.** Two runners, both 3-day/capped-weekday. §52 Am. 1's exemption already governs. Not a plan-wide finding and must not be read as one |
| `INV-PLAN-DELIVERED-RAMP` (§94, §100) 15/13 | **Already INSUFFICIENT EVIDENCE**, §94 Am. 2's freeze. Not re-derived. `DELIVERED-RAMP-REAL-DRIVER-01` still wants its attribution pass |
| `INV-PLAN-DELOAD-PHASE-POSITION` (§95) 3/3 | **Warn.** §87's "one week of stimulus then recover" residual, one week over. Counted |
| `INV-PLAN-BOUNCEBACK-BOUNDED` (§2) 2/2 | **Warn.** Willy's; message names `DELOAD-INVERSION-01` as the open lever |
| `INV-PLAN-DELOAD-IS-A-REDUCTION` (§3, §90) 2/2 | **Warn.** Same lever |
| `INV-PLAN-RUNWALK-SHORTDIST-SCOPE` (§117 Am. 8) 2/2 | 🔴 **A PLAN WE WOULD NOT HAND OVER.** A beginner at 21.1 km off a 5 km longest run with no run-walk prescription, because Am. 8 named the 5K and 10K and stopped. Already filed as `SHORTDIST-RUNWALK-SCOPE-01`; **this board's next build** |
| `INV-PLAN-INJURY-CAP-DELIVERED` (§90) 1/1 | **Warn.** Willy's; same lever |
| `INV-PLAN-MIN-LOADING-BLOCK` (§119) 1/1 | **Counted, not cleared.** Sims dissents from clearing it on prevalence; cannot be settled on 1 live plan |
| `INV-PLAN-PEAK-NOT-BELOW-START` (§106) 1/1 | **Warn, and the NEW tenth code** — absent when the item was filed. "Peak 32 km but the runner already runs 35." §106's own residual at a 30-minute weekday cap. Counted |

**So the half of the protocol that had never been read is now read: nine warns are doing their job
and one names a plan we would not hand over, and that one was already filed.** The item closes.

---

## 📦 Artifacts

| Part | Principle | Numeric | Mechanical check |
|---|---|---|---|
| A | **§116 Amendment 12** — the per-run step is a RATIO (§45's), and §106's peak band reaches the base-build block | no new constant: `LONG_RUN_PROGRESSION_CAP_PCT` and `PEAK_KM_BY_LEVEL`, both reused | `INV-PLAN-ONRAMP-PER-RUN-STEP` arm 1 re-based + a new peak-band arm + `validateBaseBuildBlock` wired into the `base_build` branch |
| B(3) | none — the item's mechanism is false; the fix was built and reverted on the measurement | none | none; the limit is recorded and the precedence filed as `S9-SECONDARY-FLOOR-PRECEDENCE-01` |
| B(1),(2) | none — no ruling | none | `rca1026Gates` DEBT entries stay |
| C | none — every code weighed against principles already ratified | none | the packet itself, regenerated by `review:coaching` |

## ↗️ SLT escalation

**None.** Nothing here turns on tier, price or build cost.

## Not raised

- **`DELIVERED-TAIL-LEVERS-01`** — §2 Amendment 2 freezes the predicate *"until we hold adherence or
  injury data"* and the item says in terms *"do not bring another corpus measurement to this item."*
  The product collects no outcomes. Not raised, and it should not be raised again until it does.
- **`LONG-RUN-CAP-INJURY-VALUE-01`** — ratified AS IS 2026-10-28 (§9 Am. 3) on three reopen
  conditions. **All three checked today and none is met:** no prototype exists in which the week
  grows with a raised long run; back and plantar fasciitis are still treated **identically** (both
  long run 25.5 → 14.5 km on yesterday's `INJURY-RECENCY-01` counterfactual); injury recency is
  RULED but not BUILT, with the Design Board owning the control. Stays ratified.

---

## 🔍 Code review of the ship — four findings, all genuine, one a real guard gap

Run once, on `1bbe197a~1..dfb7c755`. Per the standing rule from 2026-11-14, a review round is worth
running only if its last finding changed what a runner sees. **This one did.**

1. 🔴 **`engine.ts` — the new gate ran `validateBaseBuildBlock` ALONE, and I wrote a false reason
   for it.** My comment said *"`validateStagedRace` is deliberately NOT run: a standalone base build
   has no race block."* The first clause is true and **the conclusion does not follow**: since
   `GETRUNNING-WALKRUN-FLOOR-01` (2026-11-12) that function returns `validateWalkRunStart(plan)`
   when there is no `staged_race`, and **a plan with no `staged_race` is every plan this producer
   makes.** So wiring the validator *dropped the walk-run ladder gate wired for this exact producer
   three days earlier* — the function's own header says so in as many words, and **every other
   caller in the repo pairs the two.** Fixed; gated behaviourally through `runEngine` and falsified
   by dropping the arm again. ⚠️ **This is the failure class I wrote a memory about in the same
   session: a confident comment stating the wrong mechanism, where the right mechanism was written
   down in the function I chose not to call.**
2. 🔻 **The 20% cap is NOT clear of the producer, and my first answer to this finding was wrong
   because I measured the other producer.** The review named pairs at exactly 20.00% — `2.5→3.0`,
   `4.5→5.4`. I probed §118's `generateGetRunningPlan`, found **0 at or over 20%** (worst +19.23%
   over 335,708 pairs) and wrote that the counts *"do not reproduce"*. **They do.** There are two
   producers of a base-build ramp and the review measured §116's `generateBaseBuildPlan`: **90 of
   2,400 pairs (3.75%) land at or over the cap**, worst **+20.0000%**, exactly the shapes named.
   `floor1dp` quantisation means a lawful 10% WEEKLY step is not a 10% PER-RUN step. **The `+ 0.5`
   pp tolerance is therefore load-bearing**, which is now a declared limit with a case rather than
   an accident.
3. **`plan-invariants.md` — the row's normative FIRST sentence still stated the removed absolute**,
   with the correction ~2,000 words later, after the now-superseded *"do not resolve by raising the
   cap"* paragraph. Rewritten so the rule as it stands is the opening sentence and the history is
   marked as history.
4. **`baseBuildValidate.test.ts` — a test named *"the per-run cap is §2 Am.2's existing number"***
   asserts only the constant's value, so it passes whatever the code does with that constant. The
   name claimed the relationship this amendment removed. Renamed.

📐 **After the fixes: 801 files / 8,219 tests green; `tsc` 0; and the paired gate throws on 0 of
47,666 base-build plans across the whole corpus**, so pairing the arms is quiet on every live-shaped
input rather than only on the four the offer path reaches.

