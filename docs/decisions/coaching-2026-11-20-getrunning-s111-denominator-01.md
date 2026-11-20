# Coaching Board — `GETRUNNING-S111-DENOMINATOR-01` (2026-11-20)

**Trigger:** backlog item (🏃 COACHING BOARD), routed by the founder's 2026-11-20 instruction. No doctrine file edited
at this sitting; the ruling's artifacts land with the build.
**Question:** §111 has two ratio invariants with different denominators — `INV-PLAN-GET-RUNNING-BUILD-RATIO`
(block end ÷ block start, `baseBuildValidate.ts`) and `INV-PLAN-BASE-BUILD-RATIO` (peak ÷ the runner's start volume,
`invariants.ts`, error). On a ramp that follows a walk-run start they disagree. Which one governs?
**Evidence:** `scripts/board-evidence-getrunning-four.ts` (READ-ONLY; `--prod` reads `plans` with SELECT only).

## Analysis (written before any seat spoke)

**The item's figures, re-derived.**

| item says | re-measured 2026-11-20 | how |
|---|---|---|
| block-start ratio satisfied at **1.93×** | **1.93×** (start 6, ends 11.6) | item's own case, `cw 2 / lr 1`, runway 29 |
| raw ratio violated at **5.8×** on a 2 km/week runner | **5.8×** | same case, `validatePlan(plan, input)` |
| *"§118's branch in `engine.ts` never calls `validatePlan`"* and so has *"no constitutional gate"* | **Half stale.** Since §116 Am. 12 (2026-11-15, `ENGINE-BASEBUILD-UNVALIDATED-01`) the branch runs `validateBaseBuildBlock` + `validateStagedRace` (`engine.ts:349`). It still never runs `validatePlan` — **and that is the architecture, not a gap** (below). | read `engine.ts:332–356` |

**What moved since filing, and why it changes the question.**

1. **The disagreement is not between two gates that both judge a base-build plan.** Every validator path that can
   meet a stored or generated base-build plan dispatches it away from `validatePlan`: the engine's §118 branch and
   staged branch (`engine.ts:349, 389`), `validateSavedPlan`, `validateStoredPlan` (save, adjust, `/api/ops/plan-audit`)
   via `isBaseBuildPlan`, and `validateMarketingPlan`. `marketingPlan.ts:118–135` already names a base-build block
   judged by `validatePlan` a **category error** (`RESHAPE-VALIDATOR-KIND-01`'s twin), citing exactly this invariant
   reading *"∞x the runner's 0km/week base"*. The only place both verdicts are computed on one base-build plan is
   the test arm `getRunningPlan.test.ts:207` and this item's probe.
2. **The doctrine already answers it.** The walk-run-start sitting (2026-10-25, L5) ruled: *"Not a credit: §111 is
   not asked until the checkpoint"*. §118 Am. 2's ratio (the block-start one) bounds the BLOCK; §111's ratio is asked
   of the RACE plan, at the checkpoint, on the volume the runner then has.
3. **The item's 5.8× is not wizard-reachable.** The weekly ruler is `WEEKLY_KM_STEP: 5`, so a runner can send 0, 5,
   10 … never 1–4. On a production-sequence grid (ruler values, 4 distances, 8 runways, 2 training ages; 562 rows reach a
   base-build plan — 276 staged, 286 accepted §118):
   - accepted §118: raw §111 fires **0 / 286**, block-start fires **0 / 286**;
   - staged: raw §111 fires **22 / 276, every one at `cw 0`** (denominator zero → ∞, the HM sitting's *"label artefacts
     at cw ≤ 2"*), block-start fires **0 / 276**.
4. **Production:** 4 live base-build plans (`plans` table, 43 rows): raw §111 fires on **0**, block-start on **0**
   (block ratios 3.79×, 1.77×, 1.21×, 3.78×).
5. **A stale comment sits on the raw invariant.** `invariants.ts:3950` says the denominator is *"RAW
   `current_weekly_km`"*; since §111 Am. 2 it is `effectiveStartKm` (`baseVolume.ts → assessBaseBuild`). The item
   inherited the wording.

**What the evidence can and cannot show.** It shows which validator each path runs and what each invariant says on
every reachable plan in the grid and in production. It cannot show the item's sub-floor `cw 1–4` cohort exists among
real runners (unreachable by the ruler), and it does not measure the RACE block at the checkpoint, which is §111's
real moment and is generated later from observed volume.

**Settled-ground scan (`coaching-rulings.md`).** `MARATHON-VOLUME-GATE-01` (§111's denominator is the volume the
engine STARTS from), `HM-BASE-RATIO-SCOPE-01` (cw ≤ 2 firings recorded as label artefacts), `STAGED-HM-DOOR-01`
(§111's arithmetic chooses a door, never refuses), `ENGINE-BASEBUILD-UNVALIDATED-01` (§116 Am. 12 — branch now
validates), and the 2026-10-25 walk-run-start sitting L5. **Nothing settled is re-opened.**

## 🔍 Conflict scan

§111 (and Am. 2, 3, 4), §116 Am. 11 and 12, §118 Am. 2 (total build bounded at `MAX_BASE_BUILD_RATIO`), §118 Am. 4,
the §116 floor note (L1–L5). **No conflict.** The two invariants do not contradict; they answer different questions
about different plan objects, and L5 already ordered them in time.

## Seats

**🏃 Hutchinson (chair).** The item reads as two rulers on one table. It is one ruler per table. A base-build block
is not a race plan and has never been held to the race constitution anywhere a runner can reach. The question the
item actually leaves is whether the BLOCK is bounded honestly, and §118 Am. 2 does that with §111's own 4.0.

**📊 Seiler.** No intensity content. No objection.

**🎯 McMillan.** The runner who declares 0 and gets a seven-week walk-run start is not being "built 5.8×". They are
being brought to 6 km and then built from 6. A ratio against the number they were before the walk-run start counts
the walk-run start as if it were not training. L5 said so.

**🩹 Willy.** The load question is the per-run step and the total build of the running ramp, and both are gated on
that ramp from where it starts: §116 Am. 12's per-run ratio and §118 Am. 2's total. I wanted one total-build ceiling in
the constitution, not two (2026-09-20), and there is one: 4.0, measured from where the running starts. The raw
denominator would only matter if a running ramp started below 6 km, which the floor forbids.

**⚕️ Sims.** Concur. Record that the cohort with a zero denominator is the never-run cohort, which skews female and
older; the ∞ is a label, and nothing they receive is built off it.

**💪 Blagrove.** Silent (no strength content).

## ⚡ Recorded disagreements

None.

## ⚖️ Ruling — CORRECT (clarification of existing doctrine; no prescription change)

1. **A base-build block (§118 or staged) is bounded by `INV-PLAN-GET-RUNNING-BUILD-RATIO`: block end ÷ block start ≤
   `MAX_BASE_BUILD_RATIO`.** After a walk-run start the block start is `BASE_BUILD_ONRAMP_MIN_START_KM`, by L5.
2. **`INV-PLAN-BASE-BUILD-RATIO` is a race-plan invariant.** It is asked of the race block, at the checkpoint, on
   the checkpoint input (L5), and never of a base-build block. Its firing on a base-build plan is a category error,
   not a §111 breach.
3. **The item's second point is closed by §116 Am. 12**: the §118 branch is validated, by the base-build
   constitution, which is the right one.

## 📦 Required artifacts (at build)

1. **Principle** — a one-paragraph §111 note (or §118 Am. 2 note): *"§111's ratio is asked of a race plan. A base-
   build block is bounded by §118 Am. 2 against its own start; §111 is asked at the checkpoint (L5)."*
2. **Numeric** — none. `MAX_BASE_BUILD_RATIO` is unchanged and already shared.
3. **Mechanical check** — not a new `validatePlan` invariant (that would be the category error). A dispatch test:
   every production validator entry point (`runEngine` both base-build branches, `validateSavedPlan`,
   `validateStoredPlan`, `validateMarketingPlan`) hands a `plan_kind: 'base_build'` plan to the base-build
   constitution and never to `validatePlan`; falsified by routing one through `validatePlan`. The arm in
   `getRunningPlan.test.ts:207` that asserts the raw verdict as live is rewritten to assert this, and the stale
   *"RAW `current_weekly_km`"* comment at `invariants.ts:3950` is corrected to `effectiveStartKm`.

## ↗️ Hand-offs

None. SLT escalation: none.

## What this does not prove

- Not that the race block at the checkpoint is inside §111 for these runners: that block is generated later from
  observed volume and was not measured here.
- Not anything about real sub-floor runners at 1–4 km/week: the ruler cannot send those values, so the item's own
  case has no production population.
- The grid fixes `days_available: 3`, `goal: 'finish'`, `age 35`, beginner; other cells were not swept.
