# Plan Invariants — Constitutional Layer

This is the mechanical enforcement layer for `CoachingPrinciples.md`. Every rule
here corresponds to a section in the principles doc and is checked on every
generated plan via `lib/plan/invariants.ts → validatePlan()`.

**Authority chain:**
- Principle defined in `CoachingPrinciples.md`
- Numeric value defined in `lib/plan/generationConfig.ts → GENERATION_CONFIG`
- Mechanical check defined in `lib/plan/invariants.ts`
- Output verified by `validatePlan()` on every `generateRulePlan()` call

When all three layers agree, the engine is provably honouring its own
constitution. When the layers disagree, **the engine has a defect** —
not the principle.

## Enforcement

`generateRulePlan()` calls `validatePlan()` on its output:
- In `NODE_ENV=development` or `NODE_ENV=test`: **throws** on `error`-severity violations.
- In production: logs to `console.error` and returns the plan (failing soft for users).

The matrix script `scripts/r23-phase7-validation.ts` runs all archetype cases
under `NODE_ENV=test`, so any new violation breaks the matrix.

The property sweep `scripts/property-validate-plans.ts` generates plans across
a wide grid of inputs (race × fitness × days × volume × injuries × ...) and
runs `validatePlan()` on each. Designed to catch combinations no archetype covers.
Exit 1 on any violation.

## Active invariants

| Code | Principle Ref | Severity | What it checks |
|---|---|---|---|
| `INV-PLAN-MIN-SESSION-SIZE` | `CoachingPrinciples §9` | error | Every placed session ≥ `MIN_SESSION_DISTANCE_KM[type]`. Below this, "the session is too short to be coaching-meaningful." |
| `INV-PLAN-EMPTY-SESSION` | `CoachingPrinciples §9` | error | No session has both distance and duration zero. |
| `INV-PLAN-LONG-IS-LONGEST` | `CoachingPrinciples §9` | error | The long run is at least `LONG_RUN_MIN_RATIO_VS_EASY` × every easy run in the same week. |
| `INV-PLAN-LONG-CAP-MINS` | `CoachingPrinciples §9` | error | Long run duration ≤ `LONG_RUN_CAP_MINUTES[distance]`. |
| `INV-PLAN-WEEK-1-2-LONG-CAP` | `CoachingPrinciples §9` | error | First two weeks: long run ≤ `longest_recent_run × WEEK_1_2_LONG_RUN_CAP_MULTIPLIER` (or floor, whichever is higher). |
| `INV-PLAN-QUALITY-PER-WEEK` | `CoachingPrinciples §8` | error | Quality session count per week ≤ `QUALITY_SESSIONS_PER_WEEK_MAX[fitness]`. |
| `INV-PLAN-QUALITY-EXPECTED` | `CoachingPrinciples §1, §6, §8` | error | Build/peak/taper non-deload weeks with intermediate/experienced fitness and no quality suppression must place ≥ 1 quality session (unless every eligible day is blocked). Foundation weeks are exempt. Catches engines that derive fitness in one scope and ignore it in another. |
| `INV-PLAN-QUALITY-LONG-SPACING` | `CoachingPrinciples §7` | error | Quality session is at least `MIN_HOURS_BETWEEN_QUALITY_AND_LONG / 24` days from the long run. |
| `INV-PLAN-MAX-WEEKDAY-MINS` | Life-first | error | Every weekday session duration ≤ `input.max_weekday_mins` when the user has set one. |
| `INV-PLAN-RACE-SPECIFIC-EXPOSURE` (extended) | `CoachingPrinciples §22, §5` | error | *(existing per-week + ratio checks retained)* **Added 2026-08-20 (CD-18/SC-05):** a distance whose race pace is physiologically distinct from I-pace — 10K, HM, MARATHON — must OWN a `race_specific` catalogue session; the all-distance `goal_pace_sharpener` does not count. Checks availability, not presence, so it holds for every plan at those distances regardless of phase layout. 5K excluded (race pace ≈ I-pace) — an engineering judgement flagged for the board in §22. |
| `INV-PLAN-INTENSITY-DISTRIBUTION` | `CoachingPrinciples §1` | error | Plan-wide **quality-session share** ≤ `INTENSITY_DISTRIBUTION[distance].max_quality_session_pct`. **Sessions, plan-wide, ceiling** — see §1 for why all three words are load-bearing. Numerator excludes the §78 time trial (typed `hard` precisely so it does not count against `QUALITY_SESSIONS_PER_WEEK_MAX`) and the race (the goal, not training); denominator is running sessions only. Closes a four-month §34 gap: the table was declared in config, read by an offline script and by no engine code, and referenced by no invariant — which is why the *sessions vs minutes* basis error was invisible. **Skips `maintenance`-profile plans (CD-21):** a distribution ratio presupposes enough sessions to distribute, and at 2 runs/week it is undefined rather than breached — §52 already assigns the profile and emits the runner-facing note, and the skip is asserted in `intensityDistributionCd21.test.ts`. Scoped to this ceiling only: §7, §2, §9 and §45 stay binding on maintenance plans. **Ratified CD-21 (2026-08-20)** with 100K 12→15 — the six values were authored on a MINUTES basis and carried across the 2026-08-20 basis change unchanged; at 12% this ceiling and §8 were arithmetically incompatible for a 6-day 100K build plan (peak 2 quality/week = exactly `QUALITY_SESSIONS_PER_WEEK_MAX`) and §1 is the section that yielded. The earlier "verified against a 1,244,160-plan sweep" claim was void — see SWEEP-VACUOUS-01. |
| `INV-PLAN-NO-SESSIONS-ON-BLOCKED-DAYS` | `CoachingPrinciples §18` | error | No session lands on a day the runner listed in `days_cannot_train` — life-first scheduling. **The race is exempt** (§77): race day is an external fixed event, and a runner who cannot train on Wednesdays can still race on one. That carve-out was missing until 2026-08-20 and the check flagged 2,954 runners' own races as scheduling defects. |
| `INV-PLAN-COACH-NOTES-MATCH-INTENT` | `CoachingPrinciples §33` | error | A session's coach notes describe the session it actually is. Catches notes carried over from a catalogue row after the engine renamed or repurposed the session — the borrowed-voice defect §33 exists to prevent. |
| `INV-PLAN-INJURY-NO-HILLS` | `CoachingPrinciples §21` | error | Runners with knee / ITB / Achilles / shin / calf / plantar history get no hill session in **any** phase (extended from base/build 2026-08-21 — §21's peak reintroduction is gated on a symptom-free build that is not yet wired, and the least-used rotation began surfacing `hill_reps` in peak). Identified **structurally** since 2026-08-20 — via the catalogue row's step terrain rather than the word "hill" in a label, which the enricher can rewrite (D-17). |
| `INV-PLAN-RACE-WEEK-SHARPENING` | `CoachingPrinciples §26` | error | Race week bans tempo, threshold, cruise, progression, hill and VO2max work. Short sharpening reps at race pace and shakeouts only — nothing in race week can add fitness, only cost it. |
| `INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO` | `CoachingPrinciples §22` | error | For a time goal, at least half of second-half build/peak quality is goal-pace work. The companion to `INV-PLAN-RACE-SPECIFIC-EXPOSURE`: that one asks whether race-specific work is *available*, this one whether enough of it is actually *prescribed*. |
| `INV-PLAN-PEAK-LR-RACE-RATIO` | `CoachingPrinciples §24` | error | A time-targeted HM/marathon plan's peak long run reaches `PEAK_LR_RATIO_VS_RACE` × race distance. Subject to `LONG_RUN_CAP_MINUTES` (the absolute time cap wins) and to §45's progression cap — where either prevents reaching the floor, the plan downgrades to maintenance and this relaxes. |
| `INV-PLAN-RACE-SPECIFIC-LONG-RUN` | `CoachingPrinciples §25` | error | A time-targeted HM/marathon plan has at least one peak long run with a race-pace finish. A peak phase of flat aerobic long runs never rehearses running goal pace on tired legs, which is the specific thing race day asks for. |
| `INV-PLAN-VDOT-RAW-EXCEEDS-ANCHOR` | `CoachingPrinciples §20` | error | The VDOT surfaced to the runner is never *below* the anchor used to derive their training paces. Catches the discount logic being applied in the wrong direction — which would show a runner a fitness number lower than the one their paces were built from. |
| `INV-PLAN-TAPER-VARIETY` | `CoachingPrinciples §36` | error | Consecutive taper weeks do not repeat the same quality session at the same pace. Identified by **catalogue row** since 2026-08-20, not display label: §22's goal-pace rename made two genuinely different sessions read as a repeat, and the row check also catches the reverse — one row twice under two names. |
| `INV-PLAN-PEAK-VOLUME-FLOOR-LONG-RACES` | `CoachingPrinciples §46` | error | A time-targeted long-distance plan reaches a minimum peak weekly volume. Below it the time goal is not supportable by the training, and the plan must say so — either raise volume or drop to a finish goal. |
| `INV-PLAN-PEAK-LR-ALTERNATION` | `CoachingPrinciples §47` | error | Two consecutive peak weeks do not both carry a peak-level long run. The longest runs of a plan need a week between them; back-to-back peak long runs are where marathon builds break down. |
| `INV-PLAN-TAPER-DURATION-CAP` | `CoachingPrinciples §49` | error | The taper phase does not exceed the cap for the distance. Excess weeks flow to base or build — a longer taper is not a safer one, it is lost training. |
| `INV-PLAN-RETURNING-RUNNER-NOTE-PRESENT` | `CoachingPrinciples §51` | error | If the returning-runner or fresh-return allowance fired, the plan carries the note explaining it. **A silent allowance is a coaching defect** — the runner is being given a different ramp from the one the rules describe and has no way to know. |
| `INV-PLAN-QUALITY-VARIETY-FULL-PLAN` | `CoachingPrinciples §53` | error | No single quality **catalogue row** dominates the plan — cap is `floor(total/3)+1`. Counts the row (`catalogue_id`), not the label (Coaching Board 2026-08-21, CAT-ULTRA-THIN-01), consistent with §36. The residue that flip exposed was fixed at the engine, not by loosening the cap: least-used-first rotation in `selectCatalogueSession` (exhaust the pool before repeating) + `threshold_ladder` volume-gated into the thin intermediate marathon/ultra pool. Row-count residue 2,227 → 0 across the sweep. |
| `INV-PLAN-LR-MAX-WEEKLY-PCT` | `CoachingPrinciples §52` | error | The long run does not exceed `LONG_RUN_MAX_PCT_OF_WEEKLY` (60%) of the week. Beyond that the week is one run plus filler — the shape §52 calls structurally lopsided, and the reason a 2-day plan is maintenance-grade. |
| `INV-PLAN-PREP-TIME-STATUS-ANNOTATED` | `CoachingPrinciples §44` | error | Every plan carries `meta.prep_time_status`. §44 refuses or warns on a race that is too close for the build, and the runner has to be able to see which of those applied to them — a plan generated under an acknowledged prep-time warning must not look identical to one generated with room to spare. |
| `INV-PLAN-HR-ASSUMPTIONS-SURFACED` | `CoachingPrinciples §50` | error | Every plan declares which of the four HR-derivation methods produced its zones, and non-Karvonen methods carry an assumption note. A runner training to estimated zones must know they are estimated. |
| `INV-PLAN-5K10K-LR-PACE-CAP` | `CoachingPrinciples §24b` | error | A 5K/10K peak long-run pace segment is never faster than the HM-pace ceiling. Short-distance runners do not need marathon-pace work in a long run, and prescribing it turns an aerobic session into a second quality day. |
| `INV-PLAN-BUILD-LR-SEGMENT-CAP` | `CoachingPrinciples §24c` | error | A 5K/10K time-targeted **build-phase** long run carries no pace segment at all — §24c is notes-only. Race-pace work in the long run belongs to peak, not build. |
| `INV-PLAN-FINISH-GOAL-LR-CAP` | `CoachingPrinciples §24d` | error | A finish-goal long run carries no pace segment. There is no goal pace to run it at; §24d prescribes a feel-based negative split instead. Selecting race-pace work for a finish runner produced sessions named for a pace they never had. |
| `INV-PLAN-ULTRA-NO-PACE-SEGMENTS` | `CoachingPrinciples §24e` | error | An ultra long run carries no pace segment. Ultra training is pure aerobic time on feet; a paced segment inside a five-hour run is a different sport. |
| `INV-PLAN-WEEK-HAS-REST-DAY` | `CoachingPrinciples §64` | error | Every non-race week keeps at least one rest day. Six-on/one-off is the upper limit for non-elite runners; seven-on is overreaching dressed as commitment. |
| `INV-PLAN-COVERS-RACE-DATE` | `CoachingPrinciples §76` | error | The plan's weeks span the race date. Catches off-by-one plan-length arithmetic that would leave a runner with a plan ending before their race. |
| `INV-PLAN-RACE-ON-RACE-DAY` | `CoachingPrinciples §77` | error | The race session sits on the actual weekday of `race_date`. The race is an external fixed event — it does not move to suit the schedule, and it ignores `days_cannot_train` for the same reason. |
| `INV-PLAN-RECALIBRATION-HAS-SESSION` | `CoachingPrinciples §78` | error | Every week listed in `meta.recalibration_weeks` exists and carries the time-trial session. §78's rule is that the metadata follows the produced plan, never the intent: a week only counts as a recalibration week if the session was actually placed. |
| `INV-PLAN-NO-PLACEHOLDER-COPY` | analysis F6 | **warn** | No placeholder or lorem-style copy reaches a generated plan. A backstop against template text shipping to a runner. |
| `INV-PLAN-TAPER-COPY-MATCHES-DURATION` | `CoachingPrinciples §6` | error | Taper coach notes do not describe a taper length the plan does not have. Catches copy that says "two weeks out" in a three-week taper — the claim/computation mismatch class. |
| `INV-PLAN-LARGEST-SESSIONS-SPACED` | `CoachingPrinciples §7` | **warn** | The two largest sessions of a week sit at least `MIN_HOURS_BETWEEN_LARGEST_SESSIONS` (48h) apart. `warn` rather than `error` because it is often forced by the runner's available days — it surfaces a lumpy week rather than blocking one. |
| `INV-PLAN-DELOAD-IS-A-REDUCTION` | `CoachingPrinciples §3` | **warn** | A week badged `deload` must carry less volume than the week before it. Found in the 2026-08-20 baseline triage: **7% of plans contain a deload week BIGGER than the preceding one** — worst observed W8 at 22km against W7's 17km, with a 17km long run against 9.5km. The cause is arithmetic, not intent: `RECOVERY_WEEK_VOLUME_PCT` (70) applies to the volume CURVE, and where the curve ramps steeply, 70% of week N still exceeds the *delivered* volume at week N−1 — a rule honoured and still wrong (D-21). `warn` because it is known-open at a measured rate, declared AND exercised per §34, on the footing CD-21 gave §1's ceiling. Becomes `error` when DELOAD-INVERSION-01 lands. |
| `INV-PLAN-VOLUME-SHORTFALL-DECLARED` | `CoachingPrinciples §40c` | error | When a life-first constraint suppresses the peak week by `VOLUME_SHORTFALL_NOTE_THRESHOLD_PCT` (10%) or more, `meta.volume_shortfall_note` must exist. The constraint is CORRECT and stays — `max_weekday_mins` is the runner's own statement about their life; the defect is **silence**. Measured by counterfactual: a 4-day HM runner with a 45-minute weekday cap peaks at 49km where the curve wanted 66km (26% less), with nothing indicating the two asks are in tension. **Two conditions, matching the engine exactly:** ≥25% of weekday easy runs pinned at the cap (it is ACTIVE) *and* `meta.volume_shortfall_pct` ≥ threshold (it COST something). Checking pinned-ness alone was wrong — the HM archetype had 10 of 15 runs pinned while its volume still landed. The percentage is stamped at generation because an invariant cannot recompute a counterfactual. |
| `INV-PLAN-EFFORT-OR-PACE` | `CoachingPrinciples §19, §41, §40b` | error | Every quality session prescribes a pace target **or** an effort (RPE) target — never neither. §19 checks label-vs-pace; hill reps (SC-09) are the first session with no pace to check, because the gradient sets it. That absence is legitimate, but it makes a *lost* pace target indistinguishable from a deliberate one. Zone alone does not satisfy this — "Zone 4–5" is a physiological band, not an instruction a runner can execute on a hill. |
| `INV-PLAN-DERIVED-SET` | `ADR-019` | error | A session produced from a `version: 2` catalogue row carries a non-empty `derived_set`. The row holds the SHAPE (a shared row cannot also hold one runner's numbers); the session holds the resolved set. If the row is v2 and the session has none, the structure never reached the plan — the seventh gap the 2026-08-19 audit called blocking. |
| `INV-PLAN-MAIN-SET-ORDERING` | `CoachingPrinciples §8` | **warn** | A plan's largest VO2max **main set** must not exceed its largest threshold or race-pace main set by more than `MAIN_SET_ORDERING_TOLERANCE_MINS` (3). Compares main set, not session length — the warm-up floor makes session length a poor proxy — via `sessionFormat.mainSetMinutes` (single owner). **Stays `warn` after SC-10 (2026-08-21):** the absolute VO2max ceiling (`INV-PLAN-VO2MAX-MAIN-SET-CAP`, error) now carries the coaching concern — "VO2max is a race" is about ABSOLUTE duration, capped at 20 min. The residual relative inversions are all low-volume plans where a modest ≤20-min VO2max exceeds a smaller race_pace session sitting in a lighter week; a 17-min VO2max is not a race, so enforcing the relative ordering there would demand shrinking a fine session. Effort-governed hills/hikes (no pace_target) are excluded — lower impact, and deliberately long for ultras. **SC-08:** compares VO2max on its WORK minutes, not the main set (v2 VO2max carries full recovery inside the main set; tempo/race are continuous, so their main set ≈ their work — like-for-like). |
| `INV-PLAN-VO2MAX-MAIN-SET-CAP` | `CoachingPrinciples §8` | error | A paced (flat, I-pace) VO2max session's **WORK** minutes (Z4-5 time = resolved reps × the v2 work step's own length) must sit inside `[VO2MAX_WORK_MIN_MINS, VO2MAX_WORK_MAX_MINS]` (12–18) ± the rounding tolerance. SC-08 reworked this from the main-set ceiling to the work band: the flat vo2max rows are now v2, so full recovery lives inside the main set and must not count against the dose. Bounded at BOTH ends — below the floor it is not a VO2max stimulus, above the ceiling it steals from easy volume. A session with no resolvable work minutes (legacy v1, no derived set) falls back to the `VO2MAX_MAIN_SET_MAX_MINS` (20) main-set ceiling. Effort-governed hills / ultra-hikes (no `pace_target`) excluded — lower impact (SC-09), deliberately long for ultras. |
| `INV-PLAN-PEAK-IN-PEAK-PHASE` | `CoachingPrinciples §23, §40d` | error (warn on maintenance plans) | The peak phase must reach the plan's maximum weekly volume, within `PEAK_INVERSION_MATERIAL_PCT` (10%). **Plateau tolerance added 2026-08-20 (VOL-STRUCTURE-01):** the assertion was absolute and 86% of its 1080 violations were inversions under 10% — measured distribution min 1.3%, median 4.2% — which is rounding across 3–6 sessions a week, and this invariant's own note already calls holding volume from build through peak a legitimate plateau. **Nothing is left unguarded:** the same numeric is §52's fourth maintenance trigger, so an inversion at or above it makes the plan `maintenance` with a note naming the lever. Two mechanisms, one number, no gap. |
| `INV-PLAN-CATALOGUE-LINK` | `ADR-018` | error | A quality session carrying no `catalogue_id` but still matching a catalogue row **by name** — the signature of a dropped stamp. The name match is a LEGACY fallback for plans generated before SC-08a; without this check a regression is masked by that fallback until someone renames the session, which is the same silent-failure shape as the original defect (31% of quality sessions showing no rep structure). |
| `INV-PLAN-VO2MAX-ONSET` | `CoachingPrinciples §5` | error | For races ≤21km, the first VO2max session must leave ≥ `VO2MAX_ONSET_MIN_ADAPTATION_WEEKS` (5) weeks of build/peak before the taper. **Replaces a logged adjustment** — the engine used to record `V2-vo2max-onset-timing` against its own principle and generate the plan anyway, blaming a catalogue constraint that SC-07 removed; a principle the engine logs a violation against and then proceeds past is not a principle (§34 again). **Binding where reachable, recorded where not (CD-22):** below ~12 weeks the deadline falls in base phase where no quality exists, so the window is arithmetically unsatisfiable — and `5K.min_weeks` is 8, so those lengths are supported. There the plan carries `V2-vo2max-onset-unreachable` instead; the number is not lowered to 4 to force a pass, and generation does not throw. Same treatment as CD-20's withheld second quality and CD-21's maintenance exemption. Uses `classifyStimulus` from `sessionRole.ts` (single owner, INV-CLASS) rather than a fourth local label check. |
| `INV-PLAN-SECOND-QUALITY-MIN-DAYS` | `CoachingPrinciples §8, §9` | error | No week places more than one quality session when the runner's training days are below `MIN_TRAINING_DAYS_FOR_SECOND_QUALITY` (5). Derived from volume arithmetic, not preference: quality consumes 32.4% of weekly volume and easy is capped at `long / LONG_RUN_MIN_RATIO_VS_EASY`, so a 4-day week can only reach ~58% of the 67.6% it needs — an ~8% shortfall taken entirely out of the easy run. The engine records the withheld session as `rule_adjustments` entry `V8-second-quality-min-days` (CD-20 — a withheld session is a decision, not a silent absence). |
| `INV-PLAN-PHASE-FOCUS-REACHABLE` | `CoachingPrinciples §17` | error | Every category in `PLAN_SIGNATURES[distance].quality_categories_focus` must have ≥1 catalogue session eligible for that distance outside base phase. Catches a signature declaring a plan shape the catalogue cannot supply — the 10K signature declared `['vo2max','threshold']` while no threshold session was eligible for 10K, so the engine silently fell back to an aerobic row for the whole build phase. Checked per plan so an unreachable focus surfaces on the first plan generated for that distance rather than waiting for an audit. |
| `INV-PLAN-INTENSITY-ORDERING` | `CoachingPrinciples §83, §44` | error | **Cross-session** — the first invariant that compares sessions with *each other* rather than each against its own prescription. A Zone 3 session may not be prescribed faster than a Zone 4–5 session in the same plan, beyond `INTENSITY_ORDERING_TOLERANCE_PCT`. Does **not** forbid the inversion outright (the board's ruling is "reconcile it or surface it") — it forbids a plan being *silent* about one: `meta.goal_beyond_measured_fitness` must be set and `difficulty_band` must not read `comfortable`. Catches the case where an ambitious target pushes goal pace past derived interval pace, so the sessions labelled VO2max are prescribed slower than the sessions labelled race pace while carrying a wider HR band — a plan that cannot be executed as written by both pace and heart rate. **Corrected 2026-08-20:** an earlier note here recorded "the HR ladder is not checked against the pace ladder" as a known gap. It is not a gap. HR bands are a pure function of the zone (`qualityHR` is the Z3 band, `intervalsHR` is Z4→max), so the HR ladder **cannot invert** — it is structurally consistent with the zone labels by construction. Pace is the only quantity that can disagree with its own zone, because it derives from VDOT or a stated target rather than from the zone. An HR-vs-pace check would be a check that can never fire. The real residual gap, stated accurately: the invariant compares the *fastest* Z3 session against the *fastest* Z4–5 session and does not assert finer ordering *within* a band. |
| `INV-PLAN-LABEL-MATCHES-PACE` | `CoachingPrinciples §19, §10, §12` | error | A quality session's name must match its prescribed physiology, **in both directions**. Hard direction: a label implying VO2max requires Z4–Z5 and a pace within ±5% of vVO2max (raw VDOT); a label implying threshold/tempo/cruise requires Z3 and ±3% of T-pace (training anchor). **Easy direction (added 2026-08-20, CD-15/SC-02):** a label implying easy/steady/aerobic/recovery work must not appear on a session prescribed above Z2 — this is the case that shipped, where an aerobic catalogue row fell into a 5K/10K quality slot and was prescribed at T-pace as "Steady aerobic". The engine keys the rename on `catalogueRow.category` (structural); the invariant is label-based **only because the plan session carries no catalogue reference** — re-key on category when SC-08 lands. *Registry gap closed 2026-08-20: this invariant had existed in `invariants.ts` since R23 but was never listed here, so §34's "declared and exercised" rule was not actually satisfied for it.* |
| `INV-PLAN-PEAK-OVER-BASE` | `CoachingPrinciples §23` | error | For plans ≥ `PEAK_OVERLOAD_MIN_PLAN_WEEKS` weeks, peak volume must be ≥ `PEAK_OVER_BASE_RATIO` × W1, or plan flagged as `volume_profile: 'maintenance'`. W1 = first non-foundation week. Foundation weeks are excluded from the W1 baseline. |
| `INV-PLAN-DIFFICULTY-ANNOTATED` | `CoachingPrinciples §44` | error | Every generated plan carries `meta.difficulty_band ∈ {comfortable, demanding, very_demanding}`. Block-status inputs throw before plan construction, so any plan that exists must surface a demand label. Mirrors `INV-PLAN-PREP-TIME-STATUS-ANNOTATED`. |
| `INV-PLAN-DIFFICULTY-NEVER-FRONTS-UNSAFE` | `CoachingPrinciples §44` | error | The demand band may never under-state the plan's own honesty signals: (1) `prep_time_status: 'warned'` ⟹ band = `very_demanding`; (2) `compression_classification: 'constrained_by_inputs'` ⟹ band ≠ `comfortable`. Guarantees a friendly label can't front a warned timeline or an input-constrained plan (Coaching Board 2026-08-18). |
| `INV-PLAN-LR-PROGRESSION-CAP` | `CoachingPrinciples §45` | error | Week-on-week long run jump ≤ `LONG_RUN_PROGRESSION_CAP_PCT`% or `LONG_RUN_PROGRESSION_CAP_ABS_KM`, whichever is larger. Foundation → W1 boundary is exempt (foundation volume is deliberately low; the step-up to main plan is expected). |
| `INV-PLAN-COPY-MATCHES-SESSIONS` | `CoachingPrinciples §27, §41` | error | Week copy — **label and theme** — must not contradict its sessions. Asserts the rule (not a string denylist): copy naming an intensity/benchmark session requires one present; "highest volume / fitness is built" requires overload vs prior non-deload week; "feel(s) hard" requires an intensity or hard session. Foundation weeks are fully exempt. Supersedes the retired `INV-PLAN-THEME-MATCHES-PRESCRIPTION` (GEN-FIX-06 / incident N4, 2026-08-06), whose four-literal denylist missed cases like "Build — first quality session" over three easy runs. |
| `INV-PLAN-FOUNDATION-BLOCK` | `CoachingPrinciples §57` | error | Foundation weeks may only contain `easy`, `rest`, or `cross-train` sessions. Weekly volume must not exceed `current_weekly_km`. Volume increase within the block must not exceed `FOUNDATION_WEEKLY_INCREASE_PCT` (10%) per week. The longest session must not exceed `FOUNDATION_LONG_RUN_MAX_PCT` (35%) of the week's volume — a long run that dominates a reduced fresh-return week is a within-week binge per §9 (Coaching Board, Coaching-1). |

## Maintenance block invariants (MAINT-01)

Enforced by `validateMaintenanceBlock()` in `lib/plan/invariants.ts`, called from `generateMaintenanceBlock()`. Maintenance weeks are produced separately from the main plan (not by `generateRulePlan`) so these invariants do not run inside `validatePlan()` — `validatePlan()` skips any week with `phase === 'maintenance_restoration' | 'maintenance_base'`.

| Code | Principle ref | Severity | What it checks |
|---|---|---|---|
| `INV-MAINT-REST-DAY` | `CoachingPrinciples §64, §75` | error | Every maintenance week includes ≥1 rest day. Extends §64 to the post-race block. |
| `INV-MAINT-PHASE1-SESSION-TYPES` | `CoachingPrinciples §75` | error | Phase 1 (`maintenance_restoration`) weeks contain only `easy`, `rest`, or `cross-train`. Any quality/interval/tempo/long session is a violation. |
| `INV-MAINT-QUALITY-CAP` | `CoachingPrinciples §75` | error | Phase 2 (`maintenance_base`) weeks contain at most `PHASE2_QUALITY_PER_WEEK` (1) quality session. |
| `INV-MAINT-VOLUME-CEILING` | `CoachingPrinciples §75` | error | No maintenance week (Phase 1 or Phase 2) exceeds plan **base** volume (`VOLUME_CEILING_PCT_OF_BASE`, 100%). Re-anchored from plan-peak to base 2026-08-02 — the old 70%-of-peak model was "way too much" for a maintenance window. |
| `INV-MAINT-CADENCE` | `CoachingPrinciples §75` | error | No maintenance week schedules more run days/week than the athlete's real source cadence (conservative tick-over). Skipped when source cadence is unknown. |
| `INV-MAINT-INJURY-EASY-ONLY` | `CoachingPrinciples §75` | error | When `injury_history` is non-empty, no maintenance week contains a strides/quality session (detected by label — the mild-quality session is type `easy`). Layer 2. |
| `INV-MAINT-NO-RACE-SPECIFIC` | `CoachingPrinciples §75` | error | No `race_specific` or `ultra_specific` catalogue sessions permitted in any maintenance week. |
| `INV-MAINT-REENGAGEMENT-WINDOW` | `CoachingPrinciples §75 (Phase 3), §67` | error | The `reengagement` marker sits on exactly the **last `PHASE3_LAST_WEEKS` (2) Phase 2 weeks** — fewer only when Phase 2 is shorter — and on no Phase 1 week. This is what the CA-03 goal ladder gates on (MAINT-07), so a mis-marked window silently either re-opens the forward conversation mid-recovery or never opens it at all. Neither fails loudly, hence the mechanical check. |

## Reshape-time invariants

`validatePlan()` is the constitutional layer for *plan generation*. The
reshape engine (`lib/coaching/planAdjustment.ts → checkAdjustmentTriggers`)
operates on an already-generated plan and has its own structural contract
at the entry boundary:

| Code | Location | Severity | What it checks |
|---|---|---|---|
| **CHECK-RESHAPE-WEEK-LEN-7** | `checkAdjustmentTriggers` entry | throws | `currentWeekSessions.length === 7` AND every slot is a valid session object with a string `type` field. Catches the upstream defect where `Object.values(week.sessions)` returned a misaligned array because the plan's session keys were not stored in mon→sun insertion order. |

This invariant is intentionally a hard throw, not a logged warning. A
malformed week reaching the engine indicates either a) `plan_json` is
corrupted, or b) the caller is bypassing the canonical `DAY_ORDER.map` read.
Both demand visibility, not a silent degrade. The throw surfaces to the API
route's 500, which is exactly the diagnostic surface this class of bug
needs.

Full `validatePlan()` integration into the reshape *output* path
(verifying the proposed `sessionsAfter` honours the constitution before
the row is persisted) is deferred to Wave 3 of the reshape remediation
work — see backlog.

## Out of scope (deliberately)

**Week-on-week volume cap (`MAX_WEEKLY_VOLUME_INCREASE_PCT`).** This is enforced
by `buildVolumeSequence` on the planning array, but the per-week sum on the
plan output can deviate due to legitimate session-level floors (e.g. weeks 1-2
where `longest_recent × 1.10` collides with `MIN_SESSION_DISTANCE_KM.long`).
Output-level checking would produce false positives. The cap belongs at the
volume-sequence layer where it's already enforced.

## Adding a new invariant

0. **Has the Coaching Board ruled?** If this invariant encodes a *new or changed*
   coaching decision, the board rules on correctness first — `/coaching-board`,
   chaired by Hutchinson. If it mechanises a principle that already exists and is
   already agreed, proceed; you are closing an enforcement gap, not making a
   coaching decision. See ADR-017.
1. Identify the principle in `CoachingPrinciples.md`. If it's not there, write
   it first — INV-CFG-002 ("principle backstop").
2. Confirm the numeric lives in `GENERATION_CONFIG` (or a sibling config). If
   it's hardcoded, promote it first — INV-CFG-001 / N-013.
3. Add the check to `validatePlan()` with a `code`, `principle_ref`, and severity.
4. Add the row to the table above.
5. Run the matrix and the property sweep. Address any violations the new check surfaces.

**The three artifacts move together.** A coaching change is not complete until the
principle (`CoachingPrinciples.md`), the numeric (`GENERATION_CONFIG`), and the
mechanical check (here + `validatePlan()`) all land **in one commit** — INV-COACH-001.
This registry is where the third one is most often forgotten, which is why the
PostToolUse commit hook checks for it.

Where a principle genuinely cannot be mechanically checked, record that explicitly in
its `CoachingPrinciples.md` section rather than leaving a silent gap. An unenforceable
principle is a known risk; an undocumented one is a defect waiting to be discovered by
a runner.
