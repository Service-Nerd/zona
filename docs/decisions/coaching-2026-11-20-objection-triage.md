# Coaching Board — objection triage, Phase 0.1 (2026-11-20)

**Input:** founder-approved build plan, `docs/decisions/coaching-build-plan-2026-11-20.md` § 2, step 0.1, and its
decision 1: *"every FIX class reaches 0; REDEFINE and ACCEPT classes are written down with their reason."*
**Trigger:** soft (qualifies). No doctrine file is edited by this note. It rules what each `audit:plans` objection class
IS; every FIX it names re-sits with its own three artifacts, `measure:fitness` and `cohort:shape` when it is built.
**HEAD:** `fbf73a80`. **Evidence:** `scripts/board-evidence-objection-triage-01.ts` (read-only; generates in memory,
reads no stored plan, writes nothing). Modes used: default (breakdowns), `--splits`, `--cf`, `--declared`, `--cross`,
`--sample`.

---

## 0. The population, re-derived

`npm run audit:plans` on `fbf73a80`: **2,878 findings**, "no regression against the committed baseline". The evidence
script regenerates the same five cohorts with the same owner (`auditPlanQuality` + `objectionsOnly`) and reconciles
exactly: **2,878**, same per-cohort counts.

| Class | Cohort | Count | of generated |
|---|---|---|---|
| NEVER-BUILDS | cohortGrid / targetedGrid / engine personas | 1,009 / 36 / 1 | 2,882 / 1,520 / 6 |
| LONG-RUN-SHORT | beginner marathon / cohortGrid / targetedGrid / charity | 839 / 56 / 106 / 1 | 3,035 / 2,882 / 1,520 / 14 |
| BINGE-WEEK | cohortGrid / targetedGrid / charity / engine personas | 292 / 238 / 1 / 1 | |
| WEEK1-LEAP | beginner marathon | 284 | 3,035 |
| BINGE-SEVERE-75 | cohortGrid | 11 | |
| FLAT-CURVE | cohortGrid | 3 | |

⚠️ `targetedGrid` generated **1,520** against the baseline's 1,516; the class counts match the baseline.

---

## 1. Analysis (written before any seat spoke)

### 1a. NEVER-BUILDS (1,046): `peak / week 1 < 1.10`

**Every one of the 1,046 is classified `volume_profile: 'maintenance'` and carries a `volume_constraint_note`.** The
engine knows. So the question is not "does it build" but "is not building correct, and is the runner told the truth".

Split by the delivered peak against the runner's **declared** current volume (the week-1 denominator §2 Am. ratified),
then, for the plans that cut it, by a counterfactual that removes the runner's own constraints one at a time
(`--cf`: no weekday cap; then 5 days, no blocked days; then no injury / fresh-return):

| Sub-class | Count | What the plan does | Binder |
|---|---|---|---|
| **HOLDS** | **254** (249 + 4 + 1) | peak ≥ 95% of current volume | §23 "at ceiling": nowhere to ramp to |
| **CUT, weekday cap** | **109** | peak < 95% of current | removing the cap alone restores it |
| **CUT, days** | **187** | | removing cap + going to 5 days restores it |
| **CUT, declared above assessed** | **219** | | none of the runner's constraints; `peak_km_target` < current because the declared level outranks the assessed structural level |
| **CUT, engine placement** | **277** | | none of the runner's constraints; delivered < the engine's own `peak_km_target` |

- **Engine placement, 277:** 245 have a peak long run within 6 minutes of the distance's `LONG_RUN_CAP_MINUTES`
  (5K finish 107, 5K time 75, 10K time 35, 10K finish 28). With §9's `LONG_RUN_MIN_RATIO_VS_EASY = 1.25` holding every
  easy run at ≤ 80% of the long run, the week has a ceiling of `cap × (1 + (days − 1)/1.25)` minutes. Example:
  5K, 70 km/week, 5 days, structural experienced, target 70 → **58 km** (long run 88 min, easy 69 min); 5K finish,
  70 km/week, 3 days → **26 km**. The other **32** (all targetedGrid, 10K finish, 30 km/week, cap 30) are **not
  attributed**: the counterfactual did not restore them and the long run is not at cap.
- **Declared above assessed, 219:** `ruleEngine.ts` ~7296, `peakKm = (declaredUpward || isRunWalk) ? levelPeakKm :
  max(levelPeakKm, startKm × PEAK_FLOOR_VS_START_RATIO)`. §106 records this residual as deliberate. **New evidence
  (`--declared`, every declared-above plan in the cohortGrid sample, not only flagged ones):** of **1,324**, the same
  runner declaring the **assessed** level instead gets a **higher peak on 311**; of the **700** that peak below 95% of
  current volume, **126** would hold their volume by declaring lower. Declaring a higher level costs volume.
- **The note is false on 709 of the 792 cuts.** It opens *"Your weekly volume is already where this distance wants it,
  so this plan sharpens rather than builds"* (`classifyPeakOverload`, `atCeiling = ratioFails && !volumeFails &&
  !lrFails`, `ruleEngine.ts` ~8614). That predicate never compares the peak with the runner's volume. §106's own
  *"This plan peaks at N km a week, below the M km you told us"* note is suppressed whenever a maintenance note exists
  (`peakShortfall`, ~9615). By sub-class: days/cap **235 of 296**, declared-above **218 of 219**, engine **256 of 277**.

Samples printed (`--sample NEVER-BUILDS`): a 70 km/week intermediate 5K runner on 3 days handed 26 km for 11 weeks
with a 10 km long run against a declared 28 km longest; an HM masters runner at 50 km/week held at 45–49 (HOLDS).

### 1b. LONG-RUN-SHORT (1,002): marathon, peak long run < 55% of race (23.21 km)

| Sub-class | Count | Definition |
|---|---|---|
| **ROUNDING** | **65** (BM 40, cohortGrid 25) | peak long run ≥ bar − `DISTANCE_ROUNDING_PRECISION_KM` (all at 23.0 km) |
| **RUN-WALK BELOW 17** | **448** (all BM, all knee) | `run_walk_prescribed`, peak long run 16.0 km, under §117 Am. 2's 17 km bound |
| **RUN BELOW 17** | **60** (BM, all knee) | running prescription, peak long run < 17 km |
| **RUN 17 PLUS** | **429** (BM 291: 282 knee + 9 healthy; cohortGrid 31; targetedGrid 106; charity 1) | running prescription, 17 km ≤ peak long run < 22.71 km |

- In the beginner-marathon corpus the class is the **knee** history: **790 of 1,737** knee plans fire (45%) against
  **49 of 1,298** healthy (4%), and 40 of those 49 are ROUNDING.
- **Mechanism (knee):** the §12 producer cap (`INJURY_WEEKLY_INCREASE_CAP_PCT = 5`) holds the week near 27 km, §52's
  60% caps the long run at 16.2, the 0.5 km rounding floors it to **16.0**. `finish_goal_run_walk` is false on all 839,
  so these are §117 **Am. 4** plans (prescription kept, peak not reduced), and `INV-PLAN-RUNWALK-ADEQUATE` guards only
  `finish_goal_run_walk` (recorded at the 09-23 sitting 5). **Sitting 4 (09-23) measured this cohort at "17 km, VALID".
  Today it is 16.0.** It drifted under the bound with nothing to stop it.
- The knee plan printed in full (8 km/week, longest 2 km, 3 days, age 58) carries `long_run_shortfall_note`: the injury
  cap holds the long run, and *"take the walk breaks early rather than late"*. That runner is run-walk prescribed; the
  same note family on a RUN-17-PLUS plan is informal walking on a plan not prescribed to walk. ⚠️ Whether all 1,002
  carry it is **not measured** (the evidence's `lrNote` regex is too loose to claim it).
- cohortGrid's 56 are all time-target-led beginner-structure marathons at 20 km/week (54 time target).
- targetedGrid's 106: knee 66, shin 39, plantar 1; 105 fresh-return; all finish goal, 4 days; peak long run 17–18 km.

### 1c. BINGE-WEEK (532) and BINGE-SEVERE-75 (11): one session > 60% of a week

- **The session is the long run in 543 of 543.** 530 of 532 BINGE-WEEK plans have a weekday cap (cohortGrid cap 30:
  249, cap 60: 42; targetedGrid cap 30: 238; charity 45; engine persona 30); one has none. cohortGrid by days: 3-day
  196, 4-day 81, 5-day 15. Marathon 168 of 292 in cohortGrid; marathon 238 of 238 in targetedGrid.
- §52's RECORDED FINDING (S52-LOPSIDED-BOUND-01) ruled the prescription: at 3 days and a 30-minute cap the share is a
  fixed point, ten instruments were tried, *"do not re-propose a share-based post-pass"*.
- **Declared vs undeclared** (the lopsided sentence *"takes up most of the week"* anywhere in the plan meta):
  BINGE-WEEK **declared 262** (145 + 117), **undeclared 270**; BINGE-SEVERE-75 **undeclared 11 of 11**.
  **Mechanism of the silence:** `finalVolumeNote` (`ruleEngine.ts` ~9580) is a `??` chain and `lopsidedNote` is fourth;
  when an earlier note exists the lopsided fact is not written anywhere. Where it is written, it blames *"the X km a
  week you run now"*; for most of these the binder is the runner's weekday cap, which §80 Am. 1's rule (name the
  constraint that binds) says it must name.

### 1d. WEEK1-LEAP (284), beginner marathon only

- Week 1 is **14, 18 or 20 km whatever the declared volume**: placed duration-anchored sessions sized from the longest
  run (§2 Am. 3's own finding).
- **Per-session overshoot against the declared longest run is ≤ 0.3 km on all 284.** Willy's per-session arm fires 0.
- **157** floor-composed (every non-long run ≤ 4 km, the §9 easy floor): no lever exists. **127** have easy runs of
  5.8 km above the floor (72 knee, 55 healthy). Trimming them to 4.0 leaves week 1 ≈ 15 km against an 8 km base: still
  a leap by the ratio arm.
- Knee **204**, healthy **80**. The 11-20 `WEEK1-DELIVERED-CEILING-01` sitting excluded injury "because ADR-022 covers
  it". **Measured here: it does not reach week 1**; knee week 1 is the same 18–20 km shape as healthy.

### 1e. FLAT-CURVE (3)

HM, 70 km/week, cap 30, declared beginner, 3/4/5 days; delivered 23–32 km; each carries the false *"already where this
distance wants it"* note. These are the cap-bound NEVER-BUILDS shape, flat because the cap is flat.

### 1f. Settled-ground and conflict scan (amendments read, not headings)

| Class | Bears on | Finding |
|---|---|---|
| NEVER-BUILDS | §23, CB-PLAN-REVIEW-01 | "at ceiling" maintenance is licensed; "the classification is correct either way, only the description was wrong" |
| | §106 (MAINT-PROFILE-01) | §23/§46 license maintenance **when the runner's constraints** prevent overload; *"the constitution has never licensed the engine creating the condition it then honestly reports"*. Upward-declaration residual recorded as deliberate, visible via `INV-PLAN-PEAK-NOT-BELOW-START` (warn) |
| | §34, §40c, §80 Am. 1 | a residual is declared; the note names the constraint that binds |
| LONG-RUN-SHORT | §24 Am. 1, §80 Am. 1 | the engine's floor comparison tolerates its own 0.5 km rounding; a shortfall note must not fire on rounding |
| | §80 Am. 2 (both), S80-VS-S90-PRIORITY-01 | knee plans at 17 km: "the PLAN is right; the NOTE was wrong"; §90's injury ceiling wins over the long-run floor |
| | §117 Am. 2, Am. 3, Am. 4, Am. 5; sittings 4 and 5 (09-23) | 17 km bound, scored below it "run-walk or not"; unstructured walking "is a dare"; Group 2 (injured, not run-walking) keeps the scored objection, "do not bundle" |
| BINGE | §52, §52 Am. 1, S52-LOPSIDED-BOUND-01, §81 | prescription ruled; residual declared under §34 |
| WEEK1-LEAP | §2 Am. 2, Am. 3, WEEK1-DELIVERED-CEILING-01 (11-20, INCORRECT veto), ADR-022, §94 | no admissible lever; per-session hazard absent; frequency dissent (Willy, Sims) is a blocking data dependency |

No conflict with the five-zone model: no intensity question in any class.

---

## 2. The sitting

### 🏃 Alex Hutchinson (chair)
Half of these 2,878 are the auditor counting things this board already ruled correct, and half are real, and the
number alone could not tell us which. Two of the real ones are worse than "a plan that doesn't build". The engine cuts
a 70 km/week runner to 26 km and tells them their volume *"is already where this distance wants it"*. That sentence is
false on 709 plans. And the knee run-walk marathoner we measured at 17 km in September is now at 16, under our own
bound, with nothing that fires. I will not let the REDEFINEs be read as an improvement: every one moves into a watched
column, counted beside the fit rate, exactly as `DAYS-SHORT-SILENCED` and `LONG-RUN-SHORT-RUNWALK` do.

### 📊 Stephen Seiler
No intensity distribution question in any class. On the 5K/10K cuts: removing 40% of a runner's easy volume to protect
a long-run-to-easy ratio is the ratio governing the runner, not describing them. The ratio exists so the long run is the
longest run of the week. It is not a reason to delete easy running. No objection to the rest.

### 🎯 Greg McMillan
The HOLDS plans are what I would write: a 50 km/week runner doing a half does not need more miles. Leave them. The
3-day, 30-minute marathoner with a lopsided week: we ruled that, and the runner chose the constraint; tell them, and tell
them it's the 30 minutes, not their mileage. On the knee marathoners: the note already says "take the walk breaks early".
That's my dare from §117 Am. 3, written into a note. If we expect them to walk, prescribe the walk. That is not
relaxing the 55% bar for Group 2: they stop being Group 2 because their sessions change. And below 17 km we said in
September they don't get a marathon plan; they get §118.

### 🩹 Rich Willy
§90 wins and I am not reopening it: no knee long run gets longer by any of this. Two conditions. First, the 16.0 cohort is
a drift under a bound I asked for; the fix restores the bound's reach (`run_walk_prescribed`, not only
`finish_goal_run_walk`), it does not lift the injury cap to buy a kilometre. Second, on declared-above-assessed: I
objected in September to scaling a ceiling off self-reported volume. I did not agree that **declaring a higher level
should LOWER tonnage below what the same runner gets declaring the assessed level**, and 311 plans show it does. A floor
equal to the assessed-level twin adds no load the assessment would not already grant. I accept that, bounded exactly
there, and `INV-PLAN-USER-LEVEL-NO-UPWARD-TONNAGE` must be re-stated against the twin, not the band. On week 1: my arm
fires on 0 of 284. Same dissent as this morning: the residual is frequency, and we don't collect it.

### ⚕️ Stacy Sims
The volume cuts are my September argument again: a masters runner who built 50–70 km a week for bone loading is quietly
given 26–35 and told her volume is "already there". The prescription fix and the sentence fix both matter, and the
sentence matters more because she eats for the training she thinks she is doing. I associate with Willy's frequency
dissent on week 1.

### 💪 Richard Blagrove
No strength question. Silent.

---

## ⚡ Recorded disagreements

1. **Engine-placement cuts, lever order.** Seiler would relax §9's ratio toward 1.0 while the long run is time-capped;
   McMillan would rather an added easy day within `days_available`. Neither reach is measured. **Settles it:** the
   build's first step measures each lever's reach on the 245 at-cap plans before the prescription is chosen.
2. **WEEK1-LEAP frequency** (Willy, Sims): unchanged from the 11-20 sitting. **Settles it:** a current-run-frequency
   input, which Zonna does not collect (blocking data dependency, ADR-017).
3. **cohortGrid's 31 time-target RUN-17-PLUS** (Hutchinson): a run-walk prescription on a time-goal plan interacts with
   §120 Am. 4's goal-pace withholding (W3). Ruled in scope, built after GOALPACE-UNBENCHMARKED, measured separately.

---

## ⚖️ Ruling, per class

Targets are on `audit:plans`' **scored** count. A REDEFINE moves plans to a **watched** code that every report prints and
no gate scores; the auditor change lands in `lib/plan/planQuality.ts` with the baseline re-written and the reason stated.

| # | Class / sub-class | Count | Disposition | Mechanism (file:function) | Principle | Direction | Target | Wave |
|---|---|---|---|---|---|---|---|---|
| 1 | NEVER-BUILDS · HOLDS | 254 | **REDEFINE** | `classifyPeakOverload` (§23 at ceiling) | §23, CB-PLAN-REVIEW-01 | NEVER-BUILDS scores only when peak < 95% of `current_weekly_km`; otherwise watched `NEVER-BUILDS-HOLDS` | 0 scored | auditor, before W1 |
| 2 | NEVER-BUILDS · CUT by weekday cap / days | 296 (109 + 187) | **ACCEPT** the prescription; **FIX** the note (235 false) | `classifyPeakOverload` `atCeiling` (~8614); `peakShortfall` suppression (~9615) | §106, §23/§46, §34, §80 Am. 1 | the at-ceiling sentence may not be written when peak < current; the note names the binding constraint (cap or days). Then watched `NEVER-BUILDS-DECLARED-CONSTRAINT` | 0 false notes; 0 scored | W1 (copy wording to founder) |
| 3 | NEVER-BUILDS · CUT, declared above assessed | 219 | **FIX** (CORRECT WITH AMENDMENT direction to §106/§79) | `ruleEngine.ts` ~7296 `peakKm` | §106, §79, `INV-PLAN-USER-LEVEL-NO-UPWARD-TONNAGE` | the start floor applies to an upward declaration up to the **assessed-level twin's** peak, never above it; the invariant is re-stated against the twin. Willy's binding condition. §10/CD-6 `<6mo` cap still governs `startKm` | 0 plans whose peak is below the assessed-level twin's | W1, new item |
| 4 | NEVER-BUILDS · CUT, engine placement | 277 (245 at long-run cap; 32 unattributed) | **FIX** | placement under `LONG_RUN_CAP_MINUTES` × §9 `LONG_RUN_MIN_RATIO_VS_EASY` in `buildWeekSessions`; the 32 need `/zona-debug` first | §106 ("never licensed the engine creating the condition") | placement may not deliver a week below the runner's current volume when none of the runner's constraints binds; lever order measured first (disagreement 1); any residual is declared with its true cause | 0 engine-bound cuts | W1, new item (Phase 0.2's curve-vs-placed hypothesis) |
| 5 | FLAT-CURVE | 3 | **ACCEPT** the prescription; **FIX** the note | as row 2 (cap-bound) | §23, §106 | covered by row 2; then watched | 0 scored | W1 with row 2 |
| 6 | LONG-RUN-SHORT · ROUNDING | 65 | **REDEFINE** | auditor bar `race × 0.55` with no tolerance | §24 Am. 1, §80 Am. 1 | bar becomes `race × 0.55 − DISTANCE_ROUNDING_PRECISION_KM`, the engine's own tolerance | 0 scored | auditor, before W1 |
| 7 | LONG-RUN-SHORT · RUN-WALK BELOW 17 + RUN BELOW 17 | 508 (448 + 60, all knee) | **FIX** | §12 cap → §52 60% → 0.5 km floor = 16.0; §117 Am. 2's bound reads `finish_goal_run_walk` only | §117 Am. 2, Am. 4; sitting 4's measured 17 km | the 17 km bound governs every `run_walk_prescribed` plan (producer gate and `INV-PLAN-RUNWALK-ADEQUATE`); a plan that cannot reach it is served by §118 / the staged path, never as a race plan. §12 cap untouched (Willy) | 0 | W4 |
| 8 | LONG-RUN-SHORT · RUN 17 PLUS | 429 | **FIX** (prescription) | §117 Am. 5 keys run-walk on the **declared** longest run, never on the plan's delivered peak long run | §117 Am. 3, Am. 5; §80 Am. 2 | a marathon plan whose delivered peak long run is below the 55% bar carries the §117 interval on every session (the shortfall note's advice becomes the prescription). Plans then score as watched `LONG-RUN-SHORT-RUNWALK` only if ≥ 17 km (row 7 covers the rest). No long run or peak changes | 0 scored | W3 (after GOALPACE-UNBENCHMARKED; time-target 31 measured separately) |
| 9 | BINGE-WEEK · declared | 262 | **REDEFINE** | §52 lopsided week under the runner's cap/days | §52, §52 Am. 1, S52-LOPSIDED-BOUND-01, §34 | watched `BINGE-WEEK-DECLARED` when the plan carries the lopsided declaration | 0 scored | auditor, before W1 |
| 10 | BINGE-WEEK · undeclared + BINGE-SEVERE-75 | 281 (270 + 11) | **FIX** (declaration, not prescription) | `finalVolumeNote` `??` chain (~9580) drops `lopsidedNote` | §34, §52, §80 Am. 1 | the lopsided fact is always written, and names the cap or days when they bind. Then watched (≥75% stays its own watched bucket, Willy) | 0 undeclared | W5 (reads what W1/W2 move) |
| 11 | WEEK1-LEAP | 284 | **REDEFINE** | placed week 1 sized from the longest run (§2 Am. 3) | §2 Am. 2/3, WEEK1-DELIVERED-CEILING-01, §94 | scores only when the per-session arm fires; a leap whose every week-1 session is within the declared longest run + 0.5 km is watched `WEEK1-LEAP-WITHIN-LONGEST`. Frequency dissent stands | 0 scored | auditor, before W1 |

**Totals (findings):** FIX **1,714** (rows 3, 4, 7, 8, 10: 219 + 277 + 508 + 429 + 281); ACCEPT-prescription /
FIX-note **299** (rows 2 and 5: 296 + 3, of which 238 carry the false sentence); REDEFINE **865** (rows 1, 6, 9, 11:
254 + 65 + 262 + 284). 1,714 + 299 + 865 = **2,878**. Rows 2 and 5 stay scored until the note fix lands, then move to
watched; on the founder's terms every scored class reaches 0.

### 📦 Required artifacts
None from this note (no doctrine edit). Each FIX row re-sits at build time with its principle amendment, numeric (or
"none new"), invariant, `measure:fitness` and `cohort:shape`. Each REDEFINE row lands as a `planQuality.ts` change plus a
re-written `planQualityBaseline.json` whose commit names the row here. **`measure:fitness` was not run for this sitting**:
no prescription is changed by it.

### ↗️ SLT escalation
None.

---

## 3. Already-ruled build items that will move each class

Not run. These are the inventory's own stated effects, or the class each item's mechanism touches; every wave's gate
re-measures.

| Class | Items | How |
|---|---|---|
| NEVER-BUILDS | S9-QUALITY-FLOOR-REACH (W2), WEEKDAY-OVERRUN-BOUND (W2), GOALPACE-UNBENCHMARKED (W3), COACH-READ claim 6 (W4), LONG-RUN-CAP-INJURY-VALUE (W4) | quality-session sizing and weekday re-selection change delivered weekly km; the inventory quotes WEEKDAY-OVERRUN's other-standard 40.0 → 37.8% and GOALPACE's `neverBuilds` 14.2 → 14.6 / 9.4 → 9.6 (those are `measure:fitness` figures, not this auditor's) |
| LONG-RUN-SHORT | STEPBACK-SPECIFICITY (W3), LR-FINISH-WITHHELD-PRICING (W3), LONG-RUN-CAP-INJURY-VALUE + INJURY-RECENCY (W4) | peak long-run construction; the injury items touch back/plantar only (1 targetedGrid plan), **not knee**, so none moves rows 7–8 |
| BINGE | WEEKDAY-OVERRUN-BOUND (W2: its C5 reports LR-MAX-WEEKLY-PCT +32/−5), S9 (W2), BASEBUILD-DURATION (W1: §52 in base-build weeks, a different population) | weekday session sizes set the share |
| WEEK1-LEAP | none targets it. ⚠️ BASEBUILD-NO-LONG-RUN renames `WEEK1_PER_RUN_STEP_MAX_KM`; `week1Leap` reads that constant and must keep reading the week-1 value | |
| FLAT-CURVE | as NEVER-BUILDS row 2 | |

---

## What this does not prove

- **Only the five `audit:plans` cohorts.** The splits are rates of a constructed population, not of live runners.
- **The binder counterfactual removes constraints in a fixed order** (cap, then days, then injury). A plan bound by two
  at once is attributed to the later one. The 32 targetedGrid cuts are unattributed.
- **The lever reach for rows 3, 4, 7 and 8 is not measured.** Row 3's 126/311 is a twin comparison, not a built fix.
- **The week-1 "within the longest run" test uses `sessionKmSelfPaced`** on duration-anchored sessions.
- **The note-truth counts read the stored meta text**, so a wording change reclassifies them; they are counts of a
  sentence, not of a renderer.
- **Falsification:** the reconciliation line (2,878 by cohort and class against `audit:plans`) is the check that the
  evidence describes the same population; it would fail on any drift in the copied beginner-marathon grid.
