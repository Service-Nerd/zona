# Coaching ruling register — what has been decided, and what may not be re-raised

**Why this file exists.** The founder asked, repeatedly and with cause, why the
board gives different answers to the same question. The answer is not that the
board is inconsistent. It is that **each sitting was convened from the plans
rather than from the prior rulings**, so items the board had already closed came
back as new findings.

Measured on 2026-09-20, across one day of sittings:

| item | ruled | what happened next |
|---|---|---|
| **M3** (knee marathon, "the plan doesn't warn them") | **WITHDRAWN 2026-09-19** — the premise was false, the note says it | **re-presented 2026-09-20 as "the one real finding"** |
| **E5** (3 days + 30-min cap) | **CLOSED 2026-09-19** — CORRECT AS IS, McMillan's dissent recorded | **re-presented 2026-09-20 as "would not hand over"** |
| the 2026-09-20 round's `review.md` | — | **still read "REVIEW PENDING"**: the sitting's ruling was never written back, so the next sitting had nothing to read |

**The third row is the cause of the first two.** `coaching-review-round.ts`
writes a stub and says *"fill this file with the ruling"*. Nobody filled it. A
process whose memory depends on someone remembering to write it down has no
memory.

---

## TAPER-RECAL-COLUMN-01 — §68 had never applied to anybody (2026-09-22)

**Ruling: CORRECT WITH AMENDMENT.** Ship the table fix; §68 gains a recorded note that it
never executed, and a mechanical check that it **can fire**.

| | |
|---|---|
| **The defect** | `recalibrate-taper` selected `week_n, actual_load_km` from `strava_activities`. Both live on `run_analysis`. Empty map → *"insufficient actual data (0 < 2 weeks)"* on every call since the feature shipped |
| **Why an amendment, not a defect note** | Hutchinson: *this is not a defect fix restoring documented intent.* §68 has never executed, so every taper rule ratified since was measured against an engine in which it was silent. This introduces behaviour |
| **The near-miss** | 🔴 **§6 Amendment 2 also says "the week the runner ACTUALLY DID"** — and is a **different quantity**: it anchors to what the generated plan *delivers* vs what the curve intended (generation-time), while §68 anchors to what the runner *logged*. They compose; the pre-taper week sits in **peak**, where Am.2 does not reach. **No double cut.** A scan stopping at the section heading would have blocked a correct change |
| **Measured blast radius** | **2** users have any `run_analysis` load rows; **1** has the two weeks §68 requires. Cheap now, expensive later |
| **Binding on build** | `superseded_at is null` is part of the principle: `week_n` is within-plan (PLAN-WEEK-COLLISION-01), so without it the functional peak comes from a **different race**. McMillan, on copy: **the runner is never told the plan changed because they underperformed** |

**Artifacts.** Principle → §68 Amendment 1 · Numeric → the existing `TAPER_RECAL_*`
constants, unchanged and now actually read · Check → `lib/plan/taperRecalLiveness.test.ts`,
**falsified four ways including reinstating the original defect**. ⚠️ The 20 existing
assertions in `taperRecalibration.test.ts` could not have caught this: they hand the
function a map, and the defect was that the route never built one.

## Standing rulings — 2026-09-21

| Ruling | Status | May not be re-raised without |
|---|---|---|
| **W-03 homepage commitments block** | 🔴 **KILLED — CORRECT WITH AMENDMENT, and the amendment removed the item** | A block of promises answering an evidence question is the weakest available instrument. `SameWeekTwice` (W-04) already does the proof job with real plan data and the product's own verdict function; a third telling on one page is surface area. **Wood and Hutchinson reached this independently at the SLT:** *"the person asking is not short of reassurance, they are short of proof."* **Do not re-propose a commitments block.** |
| **§12 Amendment 2 — describe the METHOD, never forecast the RUNNER** | 🟢 **RATIFIED** | The first ruling in the constitution about **assertions rather than prescriptions**. A statement about the PLAN is verifiable by reading the plan; a statement about a person we have never met, with an unstated time horizon, is not something this product can know. ⚠️ **No numeric and NO INVARIANT** — no test can read a sentence and decide whether it forecasts a runner. Declared under §34 rather than discovered later. |
| **The heart-rate progress marker** | 🔴 **REJECTED after being drafted** | *"Same effort at a lower heart rate"* is uncontroversial physiology and a **hazardous instrument**: day-to-day HR at a given pace moves with heat, sleep, caffeine and stress by margins comparable to three weeks of novice adaptation. **Our own 40 s/km within-month easy-pace variability is the evidence** — the same measurement that killed the 5 s/km trend constant. Replaced by McMillan's marker: **does the hard session feel available.** |
| **A ratio on a public marketing page** | 🔴 **FORBIDDEN — inherits the P-02 veto** | At four running days 80/20 versus 90/10 is **0.8 against 0.4 quality sessions and does not quantise.** Seiler: assert the PROBLEM (recreational runners accumulate more moderate work than they intend, well supported) not the REMEDY (thin at 3 to 4 hours a week). |
| **An injury-reduction claim** | 🔴 **FORBIDDEN** | Individual injury prediction is not something this or any product can do. ⚠️ **But Willy's LOAD statement is true and was being missed:** a week with one hard day places less cumulative mechanical load than four moderate-hard runs at the same volume. Arithmetic, not prediction. **Guide only, away from the speed answer** — answering a performance question with injury reads as changing the subject. |
| **Restraint framed as REDUCTION** | 🔴 **FORBIDDEN — Sims, binding on all marketing copy** | *"Most of your week is easy so one day can be genuinely hard"* is redistribution and is safe. *"Do less"* is not, and **the copy drifts from the first to the second easily because the second is shorter.** The populations most susceptible to that reading are already under-fuelling. She also records that this objection lands harder on women in the cohort: **the copy is not competing with the runner's own doubt, it is competing with a person standing next to her.** |

Record: `docs/decisions/slt-2026-09-21-who-writes-the-content.md` (the SLT half) and
§12 Amendment 2 (the coaching half).

---

## Standing rulings — 2026-09-20, Miles teardown batch## Standing rulings — 2026-09-20, Miles teardown batch

Record: `docs/decisions/coaching-board-2026-09-20-miles-teardown-batch.md` ·
`docs/decisions/slt-2026-09-20-miles-teardown-batch.md`

| Ruling | Status | May not be re-raised without |
|---|---|---|
| **A runner-set intensity ratio (80/20 → 90/10)** | 🔴 **VETOED — Coaching Board** | Seiler's arithmetic is dispositive: **§1 counts SESSIONS**, so at 3 days the only ratios are 100/0, 67/33, 33/67 and at 4 days 75/25. **There is no 80/20 to select**, and our cohort is 3–4 days. ⚠️ **Do not re-propose this from the Miles screenshot.** What WOULD be correct is a different feature: *"this feels too easy"* / *"I'm knackered"* as a signal into the **existing reshape machinery**, never a new authority over §1. |
| **Cross-training capture, five chips** | 🔴 **INCORRECT as scoped** | The board wants **two different features from one input** — Willy needs modality + intensity + timing for load; Sims needs volume + frequency for energy availability. One chip serves neither and is the `motivation_type` outcome. Return with **one** feature and a stated engine consumer. |
| **Run-walk modality for the sub-floor marathoner** | 🔴 **NOT SCOPED** | Willy: at 8 km/wk over 4 days the runner is already running 2 km at a time; run-walk is for someone who cannot, which is **below the lower bound anyway**. **Do not build it to match a competitor.** |
| **Base-build on-ramp, as a SHAPE** | 🟢 **CORRECT WITH AMENDMENT — not approved to ship** | Six binding amendments (§2's rate not §57's · per-run step under §2 Am.2 · ≥16 weeks remaining · fuelling note · labelled pre-plan · all easy). **Chair's gate: build behind a flag, `measure:fitness` + property sweep, return.** Filed as **P-16**. |
| **§111 names a remedy §57 makes impossible** | 🟢 **FINDING, CORRECT** | `foundationBlock.ts:357` — every foundation week is `baseline × 1.10`, **flat from week 2 at any length**. §111's Recorded Limitation gains a cross-reference when P-16's artifacts land. **Do not "fix" this by raising `FOUNDATION_MAX_WEEKS`** — vetoed, and the on-ramp is a different shape. |
| **The paid DHTB coach register** | 🔴 **RULED OUT — SLT (Traynor)** | It makes the personal brand a **purchasable component**, a dependency on a person written into the revenue line. `brand.md`: the app must outlive the personal brand. **Recorded so it is not re-proposed as easy revenue.** |
| **Straight / Blunt coach register** | 🔴 **DON'T BUILD — SLT (Wood's kill mandate)** | Changes no context, no friction, no decision. Illusion-of-progress class. ⚠️ **`R19` is therefore NOT unblocked and stays parked** — *"finding a trigger is not the same as the trigger being worth pulling"* (Fried, undefended). |
| **Three "Sims asks" as one pattern** | ⚠️ **SPLIT — the bundling was an analytical error** | Cycle periodisation: contested science *and* missing data → stays blocked. `INPUT-SEX-01`: no formula reads it → **an honest null is not a gap**. **RED-S: not contested, and a real uncovered harm** → filed as **P-17**, a safety item. **Bundling let the real one hide inside the two that are fine.** |

---

## The protocol, from 2026-09-20

1. **Read this register before the sitting.** Not the plans first — the register.
2. **Any finding is checked against it before presentation.** A finding matching
   a CLOSED or WITHDRAWN row is either not raised, or raised *explicitly as a
   re-open with new evidence*, naming what is new.
3. **The sitting's ruling is written back** into the round's `review.md` and
   into this register, in the same session. Enforced by `audit-docs.sh`.
4. **A plan's verdict is mechanical first.** "Proud to hand over" =
   zero error-severity invariant violations **and** zero unreconciled coach
   objections (`planQuality`) **and** every constraint declared. The board rules
   on what that test cannot see, not on re-scoring what it can.

---

## How to re-run the review and compare like with like

Four commands. Run them in this order; each answers a different question.

```bash
npx tsx scripts/coaching-review-round.ts   # 1. generate today's 28 plans
npm run measure:envelope                   # 2. fit-for-purpose, DIFFED vs baseline
npm run audit:plans                        # 3. coach objections, diffed vs baseline
npm run verify                             # 4. everything else, incl. both gates
```

**What makes it apples-to-apples**, and every one of these is versioned in git:

| held fixed | where |
|---|---|
| the runners | `lib/plan/charityCohort.ts` — 20 personas, + 7 canonical cases |
| the weighted population | `lib/plan/useCaseEnvelope.ts` — bands and weights, each with a written reason |
| what "a coach would object to" | `lib/plan/planQuality.ts` — 7 predicates, one owner |
| what "fit for purpose" means | `lib/plan/envelopeMeasure.ts` — one owner, shared by the script and the gate |
| **last round's numbers** | `lib/plan/__fixtures__/envelopeBaseline.json` |
| what the board already decided | this file |

**Step 2 is the one that was missing until 2026-09-20.** The rates existed only
as FLOORS in test code, which is a **one-sided** gate: a drop failed the build
and **a rise was silent**. So "is this better or worse than last time, and
where?" had to be re-derived by hand every round — the same shape as the defect
that made the board appear to change its mind. `measure:envelope` now prints
the per-distance delta and the test fails on a move **in either direction**.

**Re-baselining is a declared act.** `npm run measure:envelope -- --write`,
and say in the commit which number moved and why. **Never to turn a test
green.**

### What is still NOT comparable between rounds

- **`generated-plans.md` is gitignored** (size), so the plan TEXT of an old
  round cannot be diffed. Plan-level change detection is `verify:parity`
  instead, which hashes 5,940 cases — use that, not the round files.
- **The envelope weights are assumptions.** If they change, every historical
  number becomes incomparable. That is why they are one reviewable object with
  a written reason per band, and why the charity's answer to the volume
  question will force a deliberate re-baseline.

## CLOSED — do not re-raise without new evidence, and say what is new

| ref | ruling | date | the number behind it |
|---|---|---|---|
| **`HM-ANCHOR-VS-GOAL-01`** | **CORRECT WITH AMENDMENT — §120**, but **INSUFFICIENT EVIDENCE on the bound, so NOT SHIPPED** | 09-21 | On a time-target plan `HM` resolves to **GOAL** pace, as `T` has since 2026-09-03 and as the sibling `mp_blocks` row already does. Measured on 1,296 sessions: the same runner's "HM-pace intervals" are **26 s/km too SLOW** for an ambitious goal and **45 s/km too FAST** for a conservative one; with no benchmark, `HM pace` takes **two values (6:00 / 5:20) for every target from 1:25 to 2:20**. ⚠️ **§44's live difficulty note already promises** *"race-pace sessions will bite harder"* while the engine prescribes the opposite. ⚠️ **Willy's bound is adopted but has no number yet, and BOTH obvious gates were rejected:** `goalBeyondMeasuredFitness` tests against INTERVAL pace (a fantasy detector, not a stretch bound), and `difficulty_band` is forbidden by **§44 point 3, Willy's own constraint**. A 15% bound costs 27% of these sessions their row and presses on §22's 50% floor, so it must be **measured, not chosen**. ⚠️ **The header fix ships WITH this or not at all** — the ratio invariant classifies goal-pace work by READING the header, so telling the truth drops 555 plans below §22. **Do not re-propose `difficulty_band` as the gate.** |
| **P-02 intensity as a runner control** | **INCORRECT — VETOED** | 09-20 | 80/20 is a SESSION-COUNT observation (CD-19). At 4 running days, 80/20 vs 90/10 is **0.8 vs 0.4 quality sessions — it does not quantise**, so the control is illusory at the volumes most runners train at and consequential only at the top. Willy: dialling up is the injury vector and self-selects. **Do not re-propose a ratio dial.** `hard_session_relationship` already expresses the preference and is already governed by §110 — expose that instead. |
| **§80 vs §90 priority** | **CORRECT WITH AMENDMENT — §90 WINS** | 09-20 | §80 already yields to `LONG_RUN_CAP_MINUTES` and says so; §90's ceiling joins it. ⚠️ The 09-19 sitting's premises were BOTH false: §9 SIZES and does not cap, and §80 (not §24) is what requires the 26 km — measured 208 min against the 210 min cap |
| **S52 injury-cohort urgency** | **PREMISE WITHDRAWN** | 09-20 | the 11.4% injury × fresh-return cell: **1,224 plans, ZERO firings** on today's engine. All 129 sweep firings have **no injury history**; **116 of 129 sit at 12 km/week**. Residual is low-volume day-fitting |
| **S111 level inversion** | **NOT A DEFECT — §79 working** | 09-20 | door `ceil(peak/4.0)` on a level-scaled peak = 13/17/20. Declaring intermediate declares a bigger plan needing a bigger base. §118 removed the harm: every refused cell now receives a Base Building plan |
| **MASTERS-COMPRESSED-BUILD-01** | **PREMISE WITHDRAWN — sampling artefact** | 09-20 | full cohortGrid **39,632 plans**: masters never-builds **18.1%** vs standard **18.4%**, median build **19.2%** vs **20.0%**. The harness's 17.4%-vs-28.6% came from a **1,400-row (3.4%) sample**. Mechanism real (build-weeks 9 → 8), consequence 0.8pp |
| **M3 honesty** | **WITHDRAWN** — premise false | 09-19 | `long_run_shortfall_note` already says *"take the walk breaks early rather than late"* |
| **E5 and M4** (3 days + weekday cap) | **CORRECT AS IS**, McMillan dissent recorded | 09-19 | 5% of plans exceed a 70% long-run week, worst 74.1%; §114 took >90% to 0.00%; capping is a measured fixed point |
| **§111 cap-instead-of-refuse** | **NEGATIVE RESULT** | 09-19 | 100% of refused cases would peak below the credible floor (median 22.4 km vs 52.8). Door at 13.2 km/wk is arithmetically exact |
| **beginner finish-goal quality** | **CORRECT AS IS**, unanimous | 09-19 | §110 Am. 2. Hutchinson's evidence is explicitly about *time-goal* races |
| **load-aware difficulty band** | **INCORRECT — VETOED** | 09-19 | §44 point 3; Willy authored the constraint |
| **`S53` quality repetition** | **DISSOLVED** | 09-19 | the unit was rows; the coaching unit is the category, median 4.5 exposures |
| **week-1 engine caps** | **SIX built and rejected** | 09-19/20 | four made `BINGE-WEEK` 8–12× worse; two took the marathon out of target. Willy: *"stop proposing caps"* |
| **`WEEK1-LEAP` thresholds** | **FROZEN** | 09-20 | relaxed three times in one day; any further change needs adherence or injury data, not another corpus measurement |
| **P-17 intake messaging (RED-S)** | **INCORRECT — VETOED, unanimous** | 09-20 | §24e Am. already rules *practice, never a nutrition prescription*. **Sims — the seat that RAISED RED-S — killed it:** 20–29 female is also the disordered-eating-risk cohort, and `INPUT-SEX-01` is parked so it cannot be targeted. Her actual ask SHIPPED 09-19: 27/88 → 76/88 |

### Added 2026-09-20 — **P-17 RED-S: the conflict scan found the answer, and found me out**

**VETOED, unanimously, on four independent grounds.** Do not re-propose intake
messaging on a plan. **More data does not unblock it** — a body-mass trend would
enable a *detector*, and a detector telling a young woman her weight is falling
is a larger version of the same harm.

🔴 **The submission's central claim was FALSE and the scan caught it.** I wrote
that the cohort Sims named "gets nothing". **§24e Amendment, five days earlier,
was ruled on that exact cohort with her reasoning recorded verbatim** — the
never-run beginner marathoner with seven 2h+ sessions and no fuelling mention
anywhere, measured **27 of 88 → 76 of 88**. Her ask was already delivered.

⚠️ **I convened this sitting from the plans and the code, not from the register.**
That is the standing failure, and it recurred inside five days. **Read this file
first.**

**Sims, recorded, because it is the whole ruling:** *"I raised RED-S. I am now
going to argue against the thing built from it."* First-time, predominantly
female, 20–29 is not only the RED-S cohort, it is the disordered-eating cohort,
and they overlap heavily. *"I would not put that sentence in front of ten
thousand young women to reach the fraction who are genuinely under-fuelling."*

**Hutchinson:** the mechanism is real, the *intervention* has no evidence behind
it. Nobody has shown a sentence in a running app changes what anyone eats.
**McMillan:** in person it is a conversation; on a plan it is a leaflet, and it
competes with the §24e cue that actually names an action on a specific day.
**Willy:** the honest lever for a runner under-fuelling a ramp is **the ramp**,
not a note — and that has not come to him.

**↗️ Escalated to the SLT, and it is not a coaching question:** signposting. When
a runner is in difficulty the correct move is to point at a professional, not to
advise. Sits beside `LEGAL-COUNSEL-01`.

### Added 2026-09-20 — **M4 was never a refusal**

`M4 sub-4:00 marathon, busy 3-day, weekday cap 45` carried
`expectRefusal: true` and a note reading *"by-design refusal (§44
days-minimum)"* **for months**. It is not a refusal. `DaysAvailableError`
carries two reasons and this one is **`warn_unacknowledged`** — a confirmation
prompt. The runner is told *"3 days is under the 4 a time goal needs; expect to
finish rather than hit the time"*, ticks the box, and receives a plan:
**16 weeks, 30 → 44 km, classified maintenance**, with the weekday cap's cost
spelled out (*"peak week reaches 44 km where it would otherwise have gone to
65 km"*).

⚠️ **Every review round reported "⛔ refused by design" and the board reasoned
about a runner we turn away.** Same defect as the use-case envelope had — 2,304
prompts counted as refusals — which I fixed there and **not here**, so it
survived in the corpus the board actually reads.

⚠️ **Correcting it removed the only refusal in the corpus**, so `M6` was added:
a marathon off an 8 km/week base, a genuine §111 **block** that no
acknowledgement clears.

⚠️ **And it revealed a real finding the mislabel had hidden:** M4's plan carries
`BINGE-WEEK` (worst session 69% of its week) — the same 3-days-plus-cap shape
as E5, and covered by E5's ruling above. **Measured product-wide: 3.3% of
runners see a confirmation prompt (8.4% at marathon+), 3.0% are genuinely
blocked.**

## Standing rulings — 2026-09-23

| ruling | status | note |
|---|---|---|
| **`HARNESS-COMPOSE-GAP-01`** | 🔴 **OPEN — the MEASUREMENT was defective, not the engine** | **Four of five harnesses call `generateRulePlan` and stop**; only `property-validate-plans.ts` calls `composePlanWithFoundation`, the function `/api/generate-plan` actually calls (ADR-020). So the board round, `envelopeMeasure`, `audit-plan-quality` and `cohortGrid` **have never seen a foundation week**, while any runner with a runway over 28 days gets one. ⚠️ **Worse than unchecked:** `INV-PLAN-UNCOVERED-RUNWAY-DECLARED` reads a stamp only the composer writes and is **deliberately silent without it**, so it reported CLEAN in every harness that never composed — **a green round was not evidence.** Engine EXONERATED by `scripts/foundation-review-round.ts`: 504 plans, 486 composed, 231 with blocks, **0 violations, 0 §76 breaches**. Hutchinson **narrowed the 09-20 "proud to hand over" verdict rather than withdrawing it**. ⚠️ Half-closed only — `planQuality`'s 7 coach objections still never see a foundation week. |
| **`RUBRIC-STALE-BAR-01`** | ✅ **CLOSED 2026-09-23** — doc corrected to the live bar; superseded bar and numbers RETAINED and marked, so old rounds stay readable. ⚠️ **Still no mechanism**: `audit-docs.sh` does not compare the doc's figures against `envelopeBaseline.json`, so the next drift is equally silent. | `fit-for-purpose-rubric.md` teaches *"a correct refusal counts as fit for purpose"* and quotes **95.3% / marathon 90.1% / every distance ≥90%**. `ZERO-REJECTION-01` (`1bfc664`) overturned that accounting **nine hours later the same day** on the founder's standard — *"we can't just say no, go away."* Doc written 09-20 **07:47**, ruling landed **16:34**, never updated. Live: **92.5%**, marathon **78.7% + 12.4% refused**. ⚠️ **The harm is the stale STANDARD, not the stale number** — the 09-20 sitting scored refusals as passes and recorded the marathon at 90.1%. Sims: *"it made the product look kindest to the people it was turning away."* |
| **The marathon is NOT fit for purpose under the live bar** | 🔴 **OPEN — inherited, not new** | **78.7% fit + 12.4% refused.** One marathoner in eight is told no, and `ZERO-REJECTION-01` is explicit that a refusal is a failure. Not a new finding (`MARA-LR-LOWBASE-01` is filed) but **the board must not inherit 09-20's 90.1%**, which used the superseded accounting. Every other distance is at or above target and the board **is** proud to hand those over. |
| **26 uncovered weeks at a 180-day runway** | ✅ **WITHDRAWN AT THE CONFLICT SCAN — do not re-raise** | Settled by `FOUNDATION-LONG-RUNWAY-01` (2026-09-15): the gap is structural, §57's amendment shows **a longer block is measurably useless**, so the obligation is **HONESTY, NOT COVERAGE**. Brought to this sitting as an open question and closed by the scan before any seat spoke — **the second consecutive sitting the register prevented a re-litigation.** This round supplied the opposite of new evidence: **81 of 81 plans at 180 days carry the note.** |
| **Ops-digest `foundation_week_violations` (1,1,4,8,1)** | ✅ **NOT A DEFECT — resolved before the sitting** | Two are **legacy April plans** (128–129 days before ADR-020). The other three are plans from 09-12 and 09-18 failing invariants added **after** they were generated (`STRIDES-PRESENT` 09-15, `QUALITY-NOT-ZERO` 09-16, `LONG-SESSION-FUELLING-NOTE` 09-19, `TIME-TARGET-QUALITY-FLOOR` 09-19, `RACE-NOT-VOLUME` 09-22, and `DIFFICULTY-NEVER-FRONTS-UNSAFE`, which gained a **second firing site** on 09-19 — the day after the plan it flags). **Verified against git, not the ops table.** Live-plan policy: doctrine fixes are not backfilled. |

## Standing rulings — 2026-09-23, sitting 2

| ruling | status | note |
|---|---|---|
| **`ZERO-REJECTION-SERVED-01`** | ✅ **SHIPPED 2026-09-23** (`e221888`) — chair's gate satisfied: before/after taken to the board, baseline written only after. **Whole product 92.5% → 96.0%; marathon 78.7% → 89.8%; every other distance unchanged.** 🔴 **IT DOES NOT CLEAR THE TARGET — marathon is 0.2pp under 90 and is NOT signed off.** ⚠️ **AND WHOLE PRODUCT IS NOW 96%, ABOVE ITS OWN 90–95% BAND — a question about the TARGET, open.** ⚠️ **The engine did not change**: `verify:parity` IDENTICAL, `review:cohort` unchanged every band. | **A refusal that hands the runner a validated §118 plan is NOT a dropout and must not be scored as one. It is also NOT a marathon plan and must not be scored as a pass.** It becomes a **WATCHED** quantity (`SERVED`), using the mechanism `RUBRIC-GAPS-01(a)` already ratified for `DAYS-SHORT-SILENCED`. 🔴 **THE SCAN FOUND THE ANSWER HALF-WRITTEN**: §118's own chair note says *"NO HARNESS WATCHES THIS PLAN KIND … inventing a way to score a raceless plan would be the decorative-check failure"* — so the board had already ruled §118 must not be scored by a race-shaped harness. **What was never drawn is that `measure:envelope` does not merely fail to score it, it scores it FAIL.** ⚠️ **`ZERO-REJECTION-01`'s premise was superseded nine hours after it was ruled** — it landed 09-20 16:34, §118 shipped the same day, and a refusal has led to a real plan ever since. **Measured: 522 of 522 refused marathoners are SERVED; door 80.3% / 99.6% / 100% at 4 / 8 / 15 km/wk.** **Four binding amendments:** ① recorded as a **CORRECTION, never an improvement**, with the pre-correction figure retained ② `SERVED` and `door` reported **at every sitting** — a watched quantity nobody reads is a hidden one (Seiler, Sims) ③ a refusal that is **NOT** §118-served stays a scored FAIL ④ `door` reported **per band, never averaged** — 80.3% and 100% are different promises (McMillan). **Chair's gate: implement, re-run `measure:envelope` + `review:cohort`, bring the before/after to the board BEFORE the baseline is written.** ⚠️ **Hutchinson, binding:** *"the engine did not get better. If it reads ~91%, not one runner is served differently."* |
| **`S117-LEVEL-GATE-01`** | 🔴 **INSUFFICIENT EVIDENCE** (Willy; four seats would admit) | Should §117 read the **volume-derived** structural level rather than a supplied `fitness_level`? `beginner_max_weekly_km = 20` already calls every runner in the band a beginner. **Willy: the mechanism is acceptable — §117's peak is FIXED at 34, not scaled off self-report, which was his §111 objection — but there is no evidence a runner declaring intermediate at 15 km/wk is structurally different from one declaring beginner.** *"That is an argument. It is not data."* **Settles it:** `plan_refused_by_design` showing such runners at a rate above zero; it has **never fired**. ⚠️ **RE-SIZED by McMillan, chair accepted: with §118 live this gate decides WHICH PLAN, not WHETHER A PLAN. It is no longer on the critical path to a sign-off.** |
| **Sims, recorded** | ⚠️ **Standing observation, not a finding** | The superseded rubric *"made the product look kindest to the people it was turning away"*; the current one **makes it look crueller than it is to the same people**. **Both errors landed on the low-base cohort.** *"It is not that we got the sign wrong twice — it is that this cohort is the one our instruments keep mismeasuring, because they sit at the edge of every rule."* |
| **`ONRAMP-STEP-UNITS-01` remainder** | 🔻 **FILED TO WILLY — not ruled from a table** | Above `weekly > runs × 15`, §2 and §116 Am.2 cannot both hold. ⚠️ **Willy, binding: *"Do not resolve that by raising my per-run cap. The cap is the bound I priced. If anything yields it is the volume target, and §118 not having one is why the conflict exists."*** He wants the plans, not the arithmetic. |

## OPEN — with the measurement, ready for a sitting

| ref | question | the number |
|---|---|---|
| `MARA-LR-LOWBASE-01` | should the very-low-volume marathoner be refused rather than given a short-long-run plan? | `LONG-RUN-SHORT` 8 km/wk **100%**, 15 km/wk 70%, 0% above 35. An 8 km/wk knee-history runner gets a 16.5 km peak long run for 42.2 km. ⚠️ They are admitted *because* the injury cap lowers their peak, which makes §111's ratio pass |
| `ULTRA-LR-ADEQUACY-01` | what is the right long-run bar for 50K/100K? | none exists since `ULTRA-LR-BAR-01`; §24e's back-to-backs make a single longest run the wrong unit |
| `S111-SUBFLOOR-VOLUME-01` | build a base-building plan type? | blocked on the charity's answer; runbook drafted, unsent |
| `RACE-KEY-TWO-OWNERS-01` | collapse two `raceDistanceKey` ladders? | 88 diverging values, currently unreachable (the wizard's six distances all agree) |

## Standing rulings — 2026-09-22

| Ruling | Status | May not be re-raised without |
|---|---|---|
| **`HM-ANCHOR-VS-GOAL-01` — §120 + Amendment 1** | 🟢 **SHIPPED** | On a time-target half the `HM` anchor resolves to **GOAL** pace, bounded so it is never faster than the runner's own **CV** pace. ⚠️ **The board REJECTED the constant it had itself named** (`RACE_PACE_ANCHOR_MAX_STRETCH_PCT`, a % of current HM pace): right question, wrong unit, because `INTENSITY_ORDERING_TOLERANCE_PCT` already asks how far past a derived band a goal pace may sit. **Do not re-propose a percentage-of-current-pace bound.** Measured: 60% of goal paces are SLOWER than threshold (§120 makes those easier), 15% land at or past INTERVAL pace — a 52:00 10K runner targeting 1:25 was handed 4 × 2 km at **4:02/km**, 50 s/km faster than their own VO2max pace. |
| **`RACE-WEEK-VOLUME-01` — §121** | 🟢 **SHIPPED** | The race is the test, not the training: excluded from `weekly_km` and from the plan total. Taper phase outweighed peak phase in **15.3% of plans and 50% of marathons**; excluding the race, **no taper anywhere exceeds its peak**. 🔴 **An HONESTY fix, never to be sold as a safety one** (Willy, binding) — a 12 km/week runner racing 42.2 km is at 1.7× their largest ever week and this changes that by nothing. |
| **`TAPER-OVER-PEAK-01`** | 🔴 **RULING VACATED 2026-09-22 at the re-sitting. Re-ruled CORRECT WITH AMENDMENT; NOT BUILT** | 🔴 **Not a taper defect: the PEAK is too small.** At 2 days a week a quality session replaces a third of the week, so peak weeks come out below build weeks and below the taper. **§1 counts SESSIONS**, so 2 days offers only 100/0 or **50/50** against a declared 80/20 ceiling — the arithmetic that **VETOED P-02's intensity row** at 3–4 days, never checked at 2. §90 Amendment 1 already built the yield mechanism and scoped it to injury; **the scope is what is wrong, not the mechanism.** ⚠️ Blocked on measuring the §22 exposure and cohort effect — a measurement, not a filing excuse. | ⚠️ **MEASURED AFTERWARDS, AND BOTH HALVES OF THE SUBMISSION WERE WRONG.** (a) *"At 2 days the only ratios are 100/0 or 50/50"* is the PER-WEEK arithmetic; **§1 counts sessions PLAN-WIDE (CD-19)** and the 2-day mean share is **26.6% against a 25% ceiling — over by 1.6pp**, with **no plan at any day count losing all quality**. (b) The remedy **fails its own acceptance test**: A/B'd on 1,223 plans, taper>peak went **6 → 9**, because removing quality from a taper week lets an easy run take its place and the taper grows. 🔴 **The real mechanism is an ADR-022 divergence, not intensity distribution**: a quality session is sized by a fixed work-minute dose and an easy run by the week's volume target, so at 2 days a swap costs a third of the week and nothing tops it back up — the traced peak week delivers **12 km against a declared peak target of 32**. 🔴 **THE FIRST RULING CONTRADICTED §1 CD-21 AMENDMENT 1, WHICH HAD ALREADY RULED ON THIS EXACT COHORT — and my conflict scan missed it.** CD-21 Am.1 says in terms: *"At two runs a week there is no distribution to describe — **the ratio is not violated, it is undefined**"* (Seiler), and *"**forcing compliance would mean two easy runs and no quality**"* (Sims, for the peri- and post-menopausal cohort). **That is precisely what I proposed.** ⚠️ **Both halves of the submission were also wrong:** *"at 2 days the only ratios are 100/0 or 50/50"* is the PER-WEEK frame while §1 counts PLAN-WIDE (2-day mean **26.6%** against a 25% ceiling, no plan losing all quality), and the remedy A/B's the symptom **6 → 9**. **RE-RULED:** the defect is real and belongs to **ADR-022**, not §1 — a week whose delivered volume falls materially below its own curve target must have the shortfall absorbed by its remaining easy running, the mirror of ADR-022's trim. **Willy's bound is binding:** absorption is capped by §9's long-run share and §45's progression cap; a week that still cannot reach its target runs under, honestly. **INSUFFICIENT EVIDENCE to build:** `waterFillEasyKm` (UX-WIZARD-01 Stage B) already redistributes an easy pool by day ceiling, and whether that pool is computed **before or after quality placement** is unmeasured — a one-line question with a blast radius across every day count.
| **`SESSION-SIZING-ANCHOR-01`** | ✅ **CLOSED — the premise was FALSE** | §120 §6 asserted a "sizing twin of the header defect" and never measured it. **1,320 quality sessions: 0 sized at threshold while running elsewhere.** A structured session prices its distance from its own work pace. **Do not re-file it.** |
| **`RACE-ANCHOR-CV-OVERRIDE-01`** | 🔴 **OPEN — a DEADLOCK, not a leak** | §85 shields `CV` from §22's goal-pace override; §22 requires a second-half build/peak slot to be goal-paced. **A CV row there cannot satisfy both.** 92 of 2,401 sessions, worst case 69 s/km. ⚠️ **The obvious fix was BUILT AND REVERTED the same hour** — it turns §22's own ownership arm red on 100 tests. Same shape as the §111/§57 deadlock. |

## Standing reservations — recorded, not findings

- **Willy on M5** (masters 58, +94% build): compliant, top of his range, first cell he would look at if injury reports arrive. Recorded three times.
- **Sims on M5 and M1**: bone health and low energy availability for peri-menopausal and young female runners on long slow blocks. Recorded three times.
- **Seiler on beginner monotony**: correct distribution, no objection, but the stimulus varies little. Not a defect.

## What no sitting can answer

**There is no adherence or dropout data.** One analytics event exists in the
product; no charity code has ever been redeemed. Every "proud to hand over" is a
coaching judgement with a number attached, never an outcome. **And nothing has
run on a device.**
| **`COACH-BEHIND-DAY-TWO-01` — §65 Amendment 1** | 🟢 **CORRECT WITH AMENDMENT, SHIPPED** | 09-22 | §65's implementation rule was honoured perfectly and **its purpose was not.** `daysDueByEndOfYesterday` is used correctly everywhere; today is never counted. But the Coach verdict then softened at `done / dueRef >= 0.7`, and **that ratio cannot be satisfied below FOUR sessions due** (`dueRef=1,2,3` → NEVER). `dueRef` never exceeds the week's planned sessions, so **for a three-day-a-week runner the softener could never fire — in any week, at any point in any plan. 29.0% of the cohort grid.** They miss one Tuesday and read amber, forever — and that is precisely the population §65 was written for (*"Zonna is for runners who already feel behind"*). **Ruling: a single outstanding session is never a judgement, at any session count.** ⚠️ **The precedent is this constitution's own, twice** — §1 CD-21 Am.1 (*"the ratio is not violated, it is **undefined**"*, Seiler) and `INV-PLAN-LR-MAX-WEEKLY-PCT` binding only above two runs. One outstanding session out of one due is not a ratio, it is an event. ⚠️ **ADDITIVE:** the 0.7 softener is untouched (2 of 7 behind is softened as before) and a three-day runner who does NONE of three still gets a real verdict. `BEHIND_VERDICT_MIN_SESSIONS = 2`; `lib/coaching/behindVerdict.test.ts` is **exhaustive over `dueRef` 1..7 × every `done`, not example-based** — ⚠️ **an example-based test would have passed the whole time** (`dueRef=5, done=4` works beautifully), because a reachability hole is only visible by enumerating the domain. Falsified three ways including setting the bound to **1**, at which the rule is inert. |
| **`RACE-ANCHOR-CV-OVERRIDE-01` — the ruling's safety assumption FAILED measurement** | ⚠️ **RULED, BUILT, REVERTED same day** | 09-22 | The board adopted my argument that excluding a CV row from §22's goal-pace slot is safe because *"§22 already requires that distance to own a `race_specific` row, so the slot is filled rather than emptied"*. **Built and measured on the changed engine, as the board's own procedure requires: `neverBuildsPct` ROSE (healthy masters 18.6% → 18.8%, healthy standard 12.8% → 12.9%) — the one figure `CLAUDE.md` gives NO tolerance — the cohort lost 3 plans to refusal (9,671 → 9,668), and `segmentPricedDistance` found ZERO reps-scaled threshold sessions because the CV rows excluded WERE those sessions.** 🔴 **The guarantee is not a guarantee: §22 requires the distance to OWN the row; it does not follow that the row is ELIGIBLE for this runner, in this phase, at this volume, with this fitness rank and these resolvable anchors. I reasoned from the catalogue's contents to a runner's eligible set, and those are different objects.** Reverted, not re-baselined — three runners losing a plan is worse than 92 sessions carrying a mislabelled header. ⚠️ **TWO mechanisms have now failed at opposite ends**: exempting at override time empties §22's ownership arm (100 tests red), excluding at selection time empties the eligible set. **Do not re-propose either.** The settling artefact, which neither sitting has taken: **for each of the 92 sessions, what else was actually ELIGIBLE in that slot for that runner** — not what the catalogue owns, what the selector would have returned. If the answer is nothing, the deadlock belongs to the catalogue, not to §22 or §85. |
