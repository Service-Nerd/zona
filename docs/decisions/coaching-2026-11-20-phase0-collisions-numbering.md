# Coaching build Phase 0.3 and 0.4: interaction risks measured, doctrine numbering resolved (2026-11-20)

Inputs: `coaching-build-plan-2026-11-20.md` §2 (steps 0.3, 0.4) and `coaching-build-inventory-2026-11-20.md` §2 and §4.
Read-only. No repo file other than this note was written. Every number below came from a script run in this session
against scratch copies of the tree (`git archive` of `main` @ `fbf73a80`, `proto/basebuild-no-long-run-01`,
`proto/basebuild-duration-01`, a hand-merged NO-LONG-RUN + DURATION copy, and a WEEKDAY + S9 copy) under
`/private/tmp/claude-501/-Users-russe-rts-training-hub/a8319fbc-b45c-4f4c-b30b-ad88b3e1bc09/scratchpad/`
(scripts: `measure_hold.ts`, `engine_hold.ts`, `classify3.ts`, `falsify_exempt.ts`, `fixture.ts`, `risk3b.ts`,
`risk4.ts`, `s9w/wrap_s9on.ts`; seam patches `patch_hold.py`, `patch_wr.py`).

---

## 0.3 Interaction risk 2: STAGED-RAMP's hold against `INV-PLAN-ONRAMP-CURVE-CLIMBS`

### What was built

The ruling's hold, minimally: `heldOnRampCurve` climbs at §2's rate under §3's deloads and stops at
`MAX_BASE_BUILD_RATIO × start` (4.0), then holds. It is passed to `generateBaseBuildPlan` from both staged call sites
(`generateStagedRacePlan`, `checkpointTarget`) **and from `composeWalkRunStart`**. The first cut missed that third
site, and the ruling's own anchor case still read 4.17× because it goes through the walk-run staged path. Checkpoint
placement is unchanged, as McMillan's condition requires. Validation: `validateBaseBuildBlock(…, {spaced, blocked})` +
`validateStagedRace`.

### Results

| population | today: plans with BUILD-RATIO error | hold: BUILD-RATIO | hold: plans with CURVE-CLIMBS error (weeks) | other new error codes |
|---|---|---|---|---|
| producer-direct, the ruling's own grid (HM/MAR × cw × lr × runway × door 8–40), `main` | 546 / 3,840 | **0** (max 4.00×) | **288 (568 weeks)**, every one on a week at the 4.0× line | none |
| same, wide (× 4 day sets × caps none/20/30/45 × benchmark ±), stride 8, `main` | 2,184 / 15,360 | 0 | **1,152 (2,272 weeks)** | none |
| same, wide, **DURATION option A** | 2,184 / 15,360 | 0 | **1,136 (2,131 weeks)** | none |
| same, wide, **NO-LONG-RUN option B** | 2,184 / 15,360 | 0 | **1,152 (2,272 weeks)** | none |
| **engine route** (`runEngine`, the ruling's wide grid: 2,445 staged + 211 accepted) | 0 | 0 | **0**; 0 of 2,656 plans change | none |

- **The risk is real and it is latent.** Through the engine the hold changes no plan. Called directly, the producer
  hands 1 in 13 of its plans a CURVE-CLIMBS error in place of a BUILD-RATIO error.
- 🔴 **The ruling's named test cannot see this.** HM, cw 1, runway 32, door 25 is a 16-week ramp. Under the hold it
  reaches 4.00× in its last week only (`…22.7, 24`), so it passes with 0 errors and never holds a second week. W1
  needs a second fixture that holds:
  - **HM, cw 1, lr 0, runway 52, door 40.** Today: 21 weeks, 6.72×. Hold: `16.7d, 24, 24, 24, 16.7d, 24` →
    CURVE-CLIMBS at W25, W26 and W28.
  - **Runway 40, door 30** gives a single held week, at W25.
- **DURATION's budget-held exemption clears 0 of the ratio-held weeks on every variant.** The two exemptions do not
  overlap on these grids. One cannot stand in for the other, and a ratio-held week cannot pass by sitting at a weekday
  cap.

### The rule: spec for W1, written by STAGED-RAMP-RATIO-16W-01 as §116 Amendment 15

> A non-deload base-build week whose `weekly_km` does not exceed the previous non-deload base-build week is lawful as
> **ratio-held** only if all three of the following hold. Each is recomputed from the plan and
> `meta.base_build_start_km`, never read from a producer stamp:
>
> - **(a)** The previous build week already sits at the ceiling: `prev ≥ C − tol(C)`, where
>   `C = MAX_BASE_BUILD_RATIO × base_build_start_km`.
> - **(b)** The week holds rather than falls: `curr ≥ prev − tol(prev)`.
> - **(c)** The week does not exceed the ceiling: `curr ≤ C`.
>
> `tol(x) = max(DISTANCE_ROUNDING_PRECISION_KM, x × ONRAMP_DELIVERED_DRIFT_TOLERANCE_PCT / 100)`. Both constants already
> exist; the second is re-applied by BASEBUILD-DURATION's Am. 14, so no new numeric is needed.
>
> Unchanged: Am. 7 (the block never ends on a deload), Am. 14's whole-block climb (end > week 1), and
> `INV-PLAN-GET-RUNNING-BUILD-RATIO` (still `error`, still independent).

**Measured with the rule:**

| variant | CURVE-CLIMBS weeks cleared |
|---|---|
| `main` | 568 / 568 |
| DURATION A, wide | 2,131 / 2,131 |
| NO-LONG-RUN B, wide | 2,272 / 2,272 |

**Why the tolerance arm is needed:** without it, DURATION A leaves **380 weeks (270 plans)** red. Placed sessions
rounded below the curve, so a week shows 23.7 km against a 24.0 km ceiling.

**Falsified:**

- Hold at 3.5×: the rule clears **0 of 1,114** weeks (`main`) and **0 of 3,998** (DURATION A).
- Hold at 3.9×: it clears **0 of 568**.
- A stall below the line still fails. The rule's blind band is the 2% tolerance under C.

### ⚖️ Flagged for the Coaching Board (not ruled here)

1. **Amendment 15 changes doctrine.** It adds an exemption to §116 Amendment 1's invariant. STAGED's ruling item 2
   ("runway beyond the bound HOLDS") implies it, but the ruling's artifact list names only a §118 Am. 2 note and
   "existing invariant unchanged". It needs the chair's ratification before W1 builds it.
2. 🔴 **A held ramp can never reach its door, and the plan still says it does.** In every case the hold reaches,
   `door > 4 × start`, so the ramp tops out below the door. Yet `staged_race.reaches_door` stays `true` on
   **456 of 3,840** plans (1,824 of 15,360 wide). The cause: `checkpointPlacement` decides `reachesDoor` from the
   unheld `onRampWeeksNeeded`.
   - At the checkpoint, §111 re-gates on observed volume of about 4.0 × start, which is below the door. So the runner
     cannot pass on plan volume.
   - McMillan's premise, that the runner "arrives fitter, not behind", assumes they reach the door.
   - The board must say whether a ratio-held runner is staged with `reaches_door: false` (the C4 consent path), or is
     not staged at all. The build must not choose.
3. **Copy (founder/brand, not the board):** inside a hold, the deload theme says *"The climb picks up again next
   week."* That is false, because the week after holds. Held weeks already read *"Holding steady this week."*

---

## Other interaction risks

### Risk 3 · NO-LONG-RUN B × DURATION A (combined copy; one positional-parameter conflict hand-resolved)

**Population:** DURATION's own sweep grid (28,800 inputs), stride 7 → 4,115 inputs → 978 base builds through the
production sequence.

| | DURATION A alone | A + NO-LONG-RUN B |
|---|---|---|
| never-climbs (≥ 2 build weeks, placed last ≤ week 1) | **10** | **3** |
| plans with CURVE-CLIMBS | 33 | 28 |
| over-cap weekday sessions, not floor-protected | **49** | **165** |
| weeks with one run above 60% of the week | 100 | 123 |

- **NO-LONG-RUN lets 7 of the 10 never-climbs plans climb**, which shrinks the cohort DURATION would refuse.
- **It re-opens over-cap weekday sessions, +116.** That is DURATION's C3 concern, now measured: its designated long
  run lands on a weekday for weekend-blocked runners.
- The 3 that remain are all 42.2 km with both weekend days blocked: cw 5 (3 days), and cw 8 at 5 days at two runways.
- **Not reconciled:** the DURATION note counts 8 runners (9 plans) on what it calls the same grid at stride 7. I count
  10 never-climbs plans. The two extra are the cw 8, 5-day, weekend-blocked rows.

### Risk 4 · LRHALF's run-walk carry on reshaped ramps

**How it was measured:** modelled as the ruling states it, `applyRunWalk` mapped over every §118 ramp session when
`walkRunStartPrescribed && !walkRunStartApplies`. The reseed half was not built.

| variant | sessions carried, in 412 in-scope plans | sessions with `duration_mins` | km and minutes unchanged | run-walk set drawable at read time (`composeSession` → `displayDerivedSet`) |
|---|---|---|---|---|
| `main` | 16,620 | 0 | 16,620 | 16,620 |
| NO-LONG-RUN B | 16,620 | 0 | 16,620 | 16,620 |
| DURATION A | 16,620 | 8,310 | 16,620 | 16,620 |
| DURATION A + NO-LONG-RUN B | 16,620 | 8,310 | 16,620 | 16,620 |

The 412 in-scope plans come from 572 accepted §118 plans. **No interaction found.**

### Risk 9 · S9 B × WEEKDAY `construct_samecat`

**Setup:** S9's diff applied cleanly onto the WEEKDAY prototype. WEEKDAY's own script was run (cohortGrid stride 53,
500 capped plans). With S9 off, the copy reproduces the note's figures exactly.

| | S9 off | S9 B on |
|---|---|---|
| past tolerance | 124 | **124** |
| weeks losing all quality | 12 in 6 plans | 12 in 6 plans |
| `hill_reps → intervals_long` | 37 | 37 |
| new VARIETY error | 1 | 1 |
| plan km lost | 453 | 392 |
| new DELIVERED-RAMP | 9 | 8 |
| PEAK-IN-PEAK-PHASE gone | — | 2 |
| maintenance among changed plans (before → after) | 55 → 54 | 58 → 54 |

- **WEEKDAY's ratchet and conditions do not move under S9 B.** S9 changes hill-rep distance, not minutes, and the
  overrun is measured in minutes.

### Side finding for DURATION's build

The budget-held exemption was recomputed exactly as its ruling words it: a weekday run at `duration_mins ≥ cap − 1`,
or a `floor_protected` run, and end > week 1.

- **What it clears:** on an engine-route DURATION A sweep (210 base builds, caps 20/30/45), 56 of 215 CURVE-CLIMBS
  weeks, which empties 16 of the 41 failing plans.
- **What the note claimed:** "all 33 pass except the 9 never-climbs". That figure was derived by comparing against
  the uncapped curve, which the note itself says.
- **Not reconciled.** The grid here is not the note's grid. C-condition "falsify the amended climbs check" should
  start from this.

---

## 0.4 Numbering table

**Method:**

- Sections were parsed from `## N.` headings in `docs/canonical/CoachingPrinciples.md`, and S10 from
  `StrengthPrinciples.md`.
- Every "Amendment" heading inside each section was listed.
- That list was cross-checked by grepping `§N Am.`/`Amendment N` in `coaching-rulings.md`, `plan-invariants.md`,
  `feature-registry.md` and `backlog.md`.

**Convention for a revision of an existing amendment by two builds:** letter suffixes (`3a`, `3b`). The precedent is
§111 Amendment 2a. Two builds then never write the same block.

| § | Highest present today (grep, with line) | Build → number it writes | Wave |
|---|---|---|---|
| **§116** | Am. 1–8 (table, 11327); 9 (11417); 10 (11693); 11 (11565); 12 (11468); no 13+ anywhere | BASEBUILD-NO-LONG-RUN → **Am. 13** · BASEBUILD-DURATION → **Am. 14** (its decision note's "13" is corrected at build) · STAGED-RAMP ratio-held exemption → **Am. 15** (board flag above) | W1, in that order |
| **§118** | Am. 1–3 (table "The three amendments", 12317). 🔴 **Two headings already read "§118 Amendment 4"**: 12425 (walk-run start, 10-24) and 12333 (offer scope, 11-06, `STAGED-HM-DOOR-01`); code cites both | GETRUNNING-S111 → **Am. 2a** note · STAGED-RAMP → **Am. 2b** note (the bound covers every ramp; surplus weeks hold) | 2a in W0, 2b in W1 |
| | | W0 docs fix: renumber the 11-06 heading to **Am. 5**. Update its citations: `engine.ts:425,614`, `stagedHmDoor.test.ts:1,190,420`, `coaching-rulings.md:18`. `baseBuildValidate.ts:378` cites the 10-24 one and stays | W0 |
| **§9** | unnumbered "§9 Amendment" (1466; de facto Am. 1, S9-QUALITY-MINUTES-01); Am. 2 (1491); Am. 3 (1594) | S9-QUALITY-FLOOR-REACH → unnumbered note on the §9 Amendment · LONG-RUN-CAP-INJURY-VALUE → **Am. 3a** (value split, HM yardstick) · INJURY-RECENCY → **Am. 3b** (recency clause, declarative table) | note in W2; 3a then 3b in W4 |
| **§89** | none | INJURY-HIP-INERT → **Am. 1** · ACHILLES-QUALITY-ONSET → **Am. 2** | Am. 1 in W0, Am. 2 in W4 |
| **§90** | Am. 1 (8054); Am. 2 (8587, filed under §94 as "§94 Am. 2 / §90 Am. 2"); Am. 3 (8169, "§90 Amendment 3 / §34") | PLAN-NOTE-HEAVIER + CP-90-AM3-CITATION (one commit, carries the §34 citation fix) → **Am. 3a** · PLAN-NOTE-MULTIWEEK → **Am. 3b** | W5: 3a, then 3b after the Design sitting |
| **§47** | Am. 1 (4759), 2 (4832), 3 (4720). **Am. 4 is ruled but absent: verified.** `coaching-rulings.md:3614` heads the 11-16 sitting "CORRECT WITH AMENDMENT (§47 Amendment 4)" with a SPLIT ruling. Part 1 shipped as a defect fix (`49704c66`) with "no principle text for part 1; §47's principle moves only when the chair rules (b) or (c)" | STEPBACK-SPECIFICITY-SCOPE → **Am. 4**, not 5. It is part 2 of the same ruling. The text records both parts: part 1, the stamp gate; part 2, scope (b). The note's "Am. 5, next free number" assumed 4 was written; correct it at build | W3 |
| **§3** | one unnumbered "Amendment" (751, LR-DELOAD-CUT-01) | COACH-READ claim 7 → **Am. 2**. The same commit retitles line 751 "Amendment 1" (heading only) | W4 |
| **§6** | Am. 1 (983), Am. 2 (1089) | COACH-READ claim 6 → **Am. 3** | W4 |
| **§40b** | Am. 1–3 under §40b (4303/4315/4344). ⚠️ **Am. 4 exists but is misfiled under §40d** (4158, ULTRA-ROWS-PRICED-AS-QUALITY-01, cited by `plan-invariants.md:144`) | S9-QUALITY-FLOOR-REACH → **Am. 5** | W2 |
| | | W0 docs fix: retitle 4158 "§40b Amendment 4" | W0 |
| **§81** | unnumbered "Amendment" (7223) = Am. 1; Am. 2 (7281) | WEEKDAY-OVERRUN-BOUND → **Am. 3** | W2 |
| **§96** | none | WIZARD-PAID-INPUTS engine half → **Am. 1**. Its §24e wording and §40c note are unnumbered | W3 |
| **§120** | Am. 1 (12721), 2 (12826), 3 (12993). The Am. 4 heading exists (12903, "RULED, BUILT, AND HELD — NOT SHIPPED") | GOALPACE-UNBENCHMARKED → **Am. 4** (fills the existing heading and flips its status; no new number) | W3 |
| **§44** | unnumbered "§44 Amendment" (4468, DIFFICULTY-SHORTFALL-01). ⚠️ **Am. 2 (3953, GOAL-PAST-CV-SILENT-01) and Am. 3 (4036, PROGRESSION-GOAL-INVERTED-01) are misfiled under §38**, headed "Amendment 2/3" without "§44" | GOALPACE (same commit as §120 Am. 4) → **Am. 2a** (widened gap arm) | W3 |
| | | W0 docs fix: prefix both misfiled headings with §44 | W0 |
| **§25** | Am. 1 (cited), Am. 2 (3314) | LR-FINISH-WITHHELD-PRICING → **Am. 3** (same commit as §120 Am. 4) | W3 |
| **§110b** | none | BEGINNER-TAPER-RACE-ROW → **Am. 1**, plus an unnumbered §36 note | W3 |
| **§114** | none | COACH-READ claim 5 → **Am. 1** | W3 |
| **§117** | Am. 1–8 (11777 table + headings to 12228) | GETRUNNING-WALKRUN-LRHALF → **Am. 9** | W1 |
| **§126** | none | DOUBLE-STRIDES → **Am. 1** | W0 |
| **§32** | none | TUNE-UP-CALLOUT-INERT → **Am. 1** | W5 |
| **S10** (Strength) | Am. 1–5 (StrengthPrinciples 217/234/222/244/246, physically out of order) | STRENGTH-PAIR-STRIDE → **Am. 6** · STRENGTH-CARRY-PATTERN → **Am. 7** | W7, in that order |

### Unnumbered notes (no number to collide)

| Note | Build | Wave |
|---|---|---|
| §57 cross-reference | NO-LONG-RUN | W1 |
| note on §116's floor note, L1 | WALKRUN-DELOAD-CLAIM | W0 |
| §50 Asymmetry sentence | HR-SAVE-UNEDITED-CONFIRMS | W0 |
| StrengthPrinciples S14 sentence | INJURY-HIP-INERT | W0 |
| §24e wording and §40c note | WIZARD | W3 |
| §36 note | BEGINNER-TAPER | W3 |
| §34 citation (inside §90 Am. 3a) | CP-90 | W5 |

### Corrections to the inventory's §2

1. **§40b Am. 4 "already exists" is true but misleading.** It is filed under §40d, so a reader of §40b sees Am. 1–3.
2. **§47:** use **Am. 4**, not 5 (reasoning in the table).
3. **§118:** a third collision the inventory did not list. Am. 4 is already used twice.
4. **§44:** Am. 2 and Am. 3 exist but are filed under §38.
5. **§89:** both amendments get numbers, HIP first (W0) and ACHILLES second (W4).
6. **§9 and §90:** shared edits become `3a`/`3b` rather than "one edit or strict sequence".

---

## What this does not prove

- **Risk 2 (0.3):**
  - Producer-direct grids are not production. The engine route showed 0 changed plans, so 0.3's numbers are a latent
    count, not an impact figure.
  - The hold is my minimal implementation, not W1's build. The ratio-held rule was tested by a scratch checker, not
    wired into `validateBaseBuildBlock`.
  - The NO-LONG-RUN × DURATION × hold combination was not run (risk 3 was run without the hold).
- **Risk 3:** the hand merge of the two prototypes resolved one positional-parameter conflict. No test suite was run
  on the merged copy, and `tsc` reported no errors in the four touched files only.
- **Risk 4:** the carry is modelled, not built, and "drawable" means a non-null derived set, not a correct one.
- **Risk 9:** one stride (53) of capped cohortGrid plans; injury cohorts are not measured.
- **0.4:**
  - Headings were found by pattern. An amendment written as bold prose rather than a heading could be missed.
  - Registers were grepped only for the target sections.
  - The misfiling fixes and the §118 renumber are recommendations. No file was edited.
