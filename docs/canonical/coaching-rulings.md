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
| **`TAPER-OVER-PEAK-01`** | ⚖️ **CORRECT WITH AMENDMENT — ruled, NOT BUILT** | 🔴 **Not a taper defect: the PEAK is too small.** At 2 days a week a quality session replaces a third of the week, so peak weeks come out below build weeks and below the taper. **§1 counts SESSIONS**, so 2 days offers only 100/0 or **50/50** against a declared 80/20 ceiling — the arithmetic that **VETOED P-02's intensity row** at 3–4 days, never checked at 2. §90 Amendment 1 already built the yield mechanism and scoped it to injury; **the scope is what is wrong, not the mechanism.** ⚠️ Blocked on measuring the §22 exposure and cohort effect — a measurement, not a filing excuse. |
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
