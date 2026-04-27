# Coaching Principles — The Constitution

**Authority**: Every principle in this document is implemented by exactly one named constant in `lib/plan/generationConfig.ts` (or one of the other config modules listed below). Changing a coaching numeric requires updating both this document and the config — they cannot drift.

This document is the *why*. `GENERATION_CONFIG` is the *what*. `lib/plan/ruleEngine.ts` is the *how*.

**Related**:
- `docs/canonical/coaching-rules.md` — operational rules (when to schedule, how to lay out a week, guard rails)
- `docs/canonical/zone-rules.md` — HR zone calculation
- `docs/canonical/session-catalogue.md` — concrete sessions the engine can schedule
- `docs/architecture/ADR-009-config-driven-generation.md` — why the config exists
- `docs/architecture/ADR-010-session-catalogue.md` — why the catalogue exists

---

## How to read this document

Each principle has three parts:

- **Principle** — the coaching idea, in plain language.
- **Why** — the reason. Often a brand position, an injury vector, or a non-elite-specific failure mode.
- **Config** — the named constant(s) in `lib/plan/generationConfig.ts` (or the related config files) that implement it.

If you are editing a numeric, you are editing this document. If you are editing this document, you are editing a numeric.

---

## 1. Polarised training — protection from grey zone

**Principle.** Most running should be easy. The rest should be genuinely hard. Almost nothing should sit in the middle.

**Why.** Non-elites overtrain by spending too much time in moderate-effort grey zone — runs that feel productive but produce neither aerobic adaptation nor true stress response. The brand position ("Slow down. You've got a day job.") is a statement of this principle. The longer the race, the more skewed toward easy the distribution becomes — ultras are won in Z2.

**Config.** `GENERATION_CONFIG.INTENSITY_DISTRIBUTION` — keyed by race distance. Measured in *minutes*, not kilometres, so time-based plans honour the same ratios.

```
5K / 10K     → 75% easy / 25% quality
HM           → 80% easy / 20% quality
MARATHON     → 82% easy / 18% quality
50K          → 85% easy / 15% quality
100K         → 88% easy / 12% quality
```

---

## 2. The 10% rule — injury prevention through gradual load

**Principle.** Weekly volume increases by no more than 10%. Returning runners with a deep training history get a temporary 15% allowance for the first three weeks.

**Why.** Sudden volume spikes are the most reliable predictor of running injury in non-elite athletes. The 10% rule is a coaching cliché because it works. The returning-runner exception acknowledges that an experienced runner rebuilding from a layoff is not the same as a beginner adding load — they have an aerobic and structural base waiting to be reawakened.

**Config.**
- `GENERATION_CONFIG.MAX_WEEKLY_VOLUME_INCREASE_PCT = 10`
- `GENERATION_CONFIG.RETURNING_RUNNER_ALLOWANCE_PCT = 15`
- `GENERATION_CONFIG.RETURNING_RUNNER_GRACE_WEEKS = 3`

**Volume sequence initialisation.** The starting weekly volume is clamped to a band relative to the user's target peak weekly km — too low and the plan never reaches peak; too close to peak and there's no room to ramp.
- `GENERATION_CONFIG.BUILD_VOL_INIT_FLOOR_VS_PEAK = 35` — floor: starting volume is at least 35% of peakKm.
- `GENERATION_CONFIG.BUILD_VOL_INIT_CEILING_VS_PEAK = 85` — ceiling: starting volume is at most 85% of peakKm.

A returning runner is identified by the wizard inputs `training_age > 2 years` AND `current_weekly_km < (typical for fitness level)`.

---

## 3. Recovery weeks — adaptation happens in rest

**Principle.** Every fourth week is a recovery week — volume drops to 70% of the prior build week. Masters athletes (age ≥ 45) recover every third week instead.

**Why.** Stress + rest = adaptation. Without the rest, the stress accumulates as fatigue and injury. The 4:1 cadence is a non-elite default; masters need more recovery because connective tissue and hormonal recovery slow with age.

**Config.**
- `GENERATION_CONFIG.RECOVERY_WEEK_FREQUENCY_STANDARD = 4`
- `GENERATION_CONFIG.RECOVERY_WEEK_FREQUENCY_MASTERS = 3`
- `GENERATION_CONFIG.MASTERS_AGE_THRESHOLD = 45`
- `GENERATION_CONFIG.RECOVERY_WEEK_VOLUME_PCT = 70`

Age is derived from `user_settings.date_of_birth` at plan generation time.

---

## 4. Phase structure — base, build, peak, taper

**Principle.** Plans progress through four phases. Each phase has a different purpose, a different intensity distribution, and a different long-run fraction.

**Why.** Specificity rises as the race approaches. Early phases build the aerobic engine; later phases sharpen for the demands of the actual race.

**Config.**
- `GENERATION_CONFIG.PHASE_DISTRIBUTION` — base 35%, build 35%, peak 15%, taper = remainder from `TAPER_BY_DISTANCE`
- `GENERATION_CONFIG.SPECIFICITY_BY_PHASE` — base/build/peak/taper general:specific ratios

---

## 5. Specificity — sessions resemble race demands as race approaches

**Principle.** Base phase work is general aerobic. Peak phase work looks like the race. Taper is mostly race-pace touches.

**Why.** The body adapts to what it is asked to do. A marathoner who has never run at marathon pace will run their first marathon-pace minutes on race day. The peak phase is where this is fixed.

**Config.** `GENERATION_CONFIG.SPECIFICITY_BY_PHASE`

```
base   → 100% general / 0% specific
build  → 70% general  / 30% specific
peak   → 40% general  / 60% specific
taper  → 30% general  / 70% specific
```

Specific work is selected from the catalogue (`session_catalogue.category = 'race_specific'` or `'ultra_specific'`).

---

## 6. Taper — maintain intensity, cut volume, never detrain

**Principle.** Volume drops sharply in the taper. Intensity is kept — quality sessions stay on the schedule, just shorter. The race week is for shakeouts, not training.

**Why.** Detraining shows up within 10 days of stopping intensity. Keeping a single quality session per taper week preserves neuromuscular sharpness without adding fatigue. Volume is cut because volume is the fatigue driver.

**Config.**
- `GENERATION_CONFIG.TAPER_BY_DISTANCE` — taper duration (days) and volume reduction (% per week) per distance
- `GENERATION_CONFIG.TAPER_QUALITY_PER_WEEK` — quality session count per taper week, race week always `0`

```
5K / 10K     → 10 days, 35% reduction, [1, 0]
HM           → 14 days, 45% reduction, [1, 1, 0]
MARATHON     → 21 days, 55% reduction, [1, 1, 1, 0]
50K          → 21 days, 55% reduction, [1, 1, 1, 0]
100K         → 28 days, 60% reduction, [1, 1, 1, 1, 0]
```

---

## 7. Hard / easy — never two hard days in a row

**Principle.** A quality session and a long run are both fatiguing. They cannot be back-to-back.

**Why.** Running a long run on heavy legs from a hard session the day before is the most reliable injury vector for non-elite runners with limited recovery time. Standard practice is at least 48 hours between any two stressors.

**Config.**
- `GENERATION_CONFIG.MIN_HOURS_BETWEEN_QUALITY = 48`
- `GENERATION_CONFIG.MIN_HOURS_BETWEEN_QUALITY_AND_LONG = 48`

Note: the rebuild spec proposed 24 h for the second value. Overridden to 48 h on coaching grounds — for the target audience, 24 h is the typo, not the rule.

---

## 8. Quality session frequency — fitness ceiling

**Principle.** A user's fitness level caps how many quality sessions per week the engine may schedule.

**Why.** A beginner asking for "intermediate" structure breaks down. Quality work requires an aerobic base to absorb it. The ceiling exists so the engine cannot generate a plan that the user is not ready to run.

**Config.** `GENERATION_CONFIG.QUALITY_SESSIONS_PER_WEEK_MAX`

```
beginner     → 0 (no quality at all in base; light tempo only after week 4)
intermediate → 2
experienced  → 2
```

(Spec proposed 3 for experienced. Overridden to 2 — for the target audience, the third quality session is rarely accommodated by life and consistently produces the symptoms ZONA exists to prevent.)

**Quality session sizing:**
- `GENERATION_CONFIG.QUALITY_SESSION_PCT_OF_WEEKLY = 18` — primary quality session distance as % of weekly volume.
- `GENERATION_CONFIG.SECONDARY_QUALITY_PCT_OF_PRIMARY = 80` — when two quality sessions are scheduled (peak experienced), the second is 80% of the first. Different stressor profile, slightly less volume.

---

## 9. Long-run rules — fraction of weekly, capped by distance

**Principle.** Long runs scale with weekly volume (so a 30 km/week runner does not get the same long run as a 60 km/week runner). They are also capped by an absolute time ceiling per race distance.

**Why.** A long run that exceeds 35% of weekly volume is a binge — fatigue accumulates faster than aerobic gain. The absolute cap (in minutes, not km) protects against unrealistic time-on-feet for the race.

**Config.**
- `GENERATION_CONFIG.LONG_RUN_PCT_OF_WEEKLY_VOLUME` — phase-aware (base 28%, build 30%, peak 32%, taper 40%)
- `GENERATION_CONFIG.LONG_RUN_CAP_MINUTES` — per distance (90/120/135/210/300/420)
- `GENERATION_CONFIG.WEEK_1_2_LONG_RUN_CAP_MULTIPLIER = 1.1` — first two weeks may not exceed `longest_recent_run_km × 1.1`
- `GENERATION_CONFIG.LONG_RUN_MIN_RATIO_VS_EASY = 1.25` — long run must always be ≥ 1.25× the easy session distance. Engine redistributes weekly volume when the natural phase-fraction would invert this (low-volume / low-day-count plans).
- `GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM` — floor distances per session type (long: 5, easy: 4, quality: 5, secondary_quality: 4). Below these, the session is too short to be coaching-meaningful.

---

## 10. VDOT conservatism — protect users from themselves

**Principle.** Training paces derived from a benchmark are discounted by 3% by default. Stale benchmarks (more than 6 months old) get a further 5% discount.

**Why.** A non-elite runner who PBs a 5K and then trains at 100% of the implied VDOT pace is a runner about to get injured. The discount acknowledges that race-day pace is a peak output, not a sustainable training pace, and that fitness drifts. The signature ZONA move is to err on the side of restraint when in doubt.

**Config.**
- `GENERATION_CONFIG.VDOT_CONSERVATIVE_DISCOUNT_PCT = 3`
- `GENERATION_CONFIG.VDOT_STALE_BENCHMARK_ADDITIONAL_DISCOUNT_PCT = 5`
- `GENERATION_CONFIG.VDOT_STALE_BENCHMARK_MONTHS = 6`

The applied discount is surfaced in `plan.meta.vdot_discount_applied_pct` so the user can see what the engine did and why.

---

## 11. Pace ranges, not points

**Principle.** Pace targets are always quoted as ranges (e.g. `5:50–6:05 /km`), not point values.

**Why.** A point value is read as a target to hit. A range is read as a band to stay inside. The latter trains the right behaviour: pace discipline, not pace chasing.

**Config.** `GENERATION_CONFIG.USE_PACE_RANGES_NOT_POINTS = true`

**Display precision:**
- `GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM = 0.5` — every session distance rounds to the nearest 0.5 km before display. 11.9 → 12.0; 14.7 → 14.5; 8.4 → 8.5. Whole-number-ish without losing useful precision.

---

## 12. Easy-run zone cap — Z2 ceiling

**Principle.** Easy runs are capped at the top of Z2.

**Why.** Z2 is the band where aerobic adaptation happens without accumulating fatigue. Running easy at Z3 looks productive — it is the grey zone the brand is built to prevent.

**Config.** `GENERATION_CONFIG.EASY_RUN_ZONE_CAP = 'Z2_TOP'` — resolves at runtime to the top of `GENERATION_CONFIG.ZONES.Z2` for the user's active zone method.

---

## 13. Fitness classification — VDOT first, volume fallback

**Principle.** Fitness level (`beginner | intermediate | experienced`) is derived from VDOT when a benchmark is available, and from weekly volume + longest recent run otherwise.

**Why.** VDOT is the more accurate signal. Volume-based classification is a pragmatic fallback for the no-benchmark case.

**Config.**
- `GENERATION_CONFIG.FITNESS_THRESHOLDS.vdot_beginner_max = 35`
- `GENERATION_CONFIG.FITNESS_THRESHOLDS.vdot_intermediate_max = 50`
- Volume fallback: in `lib/plan/ruleEngine.ts` `deriveFitnessLevel()`

---

## 14. HR zones — five zones, two formulas, one config

**Principle.** Five named zones (Z1–Z5) with explicit % bands. Karvonen (HR Reserve) when the user's resting HR is known; %MaxHR when only max HR is known.

**Why.** Five zones is the convergent industry standard (Daniels, Friel, Coggan all collapse cleanly to five). Karvonen is more personalised when RHR is captured. The %MaxHR fallback exists so a user without RHR still gets meaningful targets, not a refusal.

**Config.** `GENERATION_CONFIG.ZONES`

```
Z1 → 50–60% HRR  / 65–70% MHR
Z2 → 60–70% HRR  / 70–80% MHR
Z3 → 70–80% HRR  / 80–87% MHR
Z4 → 80–90% HRR  / 87–93% MHR
Z5 → 90–100% HRR / 93–100% MHR
```

The forward-compat hook for a future paid "zone method selector" feature lives here. Adding Daniels, Coggan, or Friel zone tables means adding a new key under `ZONES` and a single `user_settings.zone_method` lookup. See `docs/canonical/zone-rules.md`.

---

## 15. Tier semantics — Option A: granted-at-trial, retained-in-free

**Principle.** What a user gets during their 14-day trial is theirs to keep within the free tier — *for the plan they generated*. Ongoing intelligent features (new plan generation, dynamic reshaping, AI coach notes on new sessions, Strava-derived intelligence) become paid-only at downgrade.

**Why.** The brand position is that free users are never abandoned. Stripping a user's plan after 14 days violates that. But ZONA is also a business — ongoing intelligence is the value the subscription buys. Option A is the line.

**Config.** `lib/plan/featureGates.ts`:
- `FEATURE_GATES.GRANTED_AT_TRIAL_RETAINED_IN_FREE` — personalised plan, VDOT pace zones, HR zones, AI coach notes that already exist on a plan, full session catalogue, initial injury adaptations
- `FEATURE_GATES.PAID_ONLY_ONGOING` — dynamic reshape (R20), new AI coach notes, new injury adaptations, Strava intelligence, confidence score, ultra plan generation, tailored strength sessions
- `FEATURE_GATES.FREE_ALWAYS` — generic plan templates, rule-engine regeneration (no AI), manual session completion, plan view, basic strength sessions

**Note (R23-D6 resolution, 2026-04-25):** Plan regeneration itself is free —
users may rerun the wizard at any time. The paid value on regen is the AI
enrichment layer (gated via `ai_coach_notes_new`), not the act of regenerating.

---

## 16. Universal run format — every run has a shape

**Principle.** Every run prescribed by the engine has a structured warm-up, main set, and cool-down. Quality sessions add strides. Marathon and half-marathon long runs in peak phase add a race-pace segment.

**Why.** Telling a user "run 8 km easy" leaves the question of warm-up and cool-down unanswered. The structured format teaches the right habit and prevents the most common quality-session error (skipping the warm-up and starting cold into intervals).

**Config.** `lib/plan/sessionFormat.ts` exports `SESSION_FORMAT`:
- 10/80/10 warm-up/main/cool-down split, with minimums
- Quality warm-up minimum 15 minutes
- Strides: 4 × 20s for quality
- Long-run race-pace: 20% of session time at race pace, peak phase, HM and MARATHON only

---

## 17. Plan signatures — distance shapes the plan

**Principle.** Each race distance has a signature: minimum/ideal/maximum weeks, default sessions per week, taper final session, and the catalogue categories that apply.

**Why.** A 5K plan and a 100K plan share almost no structure beyond the four-phase shape. The signature captures the differences without forcing them into the engine's branching logic.

**Config.** `lib/plan/planSignatures.ts` — `PLAN_SIGNATURES` keyed by distance.

---

## 18. Blocked-day enforcement — life-first scheduling

**Principle.** Sessions MUST never be scheduled on days listed in `days_cannot_train`, regardless of week type (base, build, peak, taper, race). Race-week shakeouts MUST be placed on `days_available` only. If race-week scheduling cannot place two shakeouts without using a blocked day, place one shakeout — never violate the constraint to fit a default pattern.

**Why.** "Slow down. You've got a day job." is a literal claim. A user who cannot train on Tuesdays cannot train on Tuesdays in race week either. Hardcoded shakeout patterns (tue/thu) are residue from elite-runner templates and break the brand's core promise — that the plan respects the runner's life. The race week is the most visible week of the plan; getting it wrong undermines trust at the worst moment.

**Config.** No numeric — structural rule. Implemented by `blockedDays()` in `lib/plan/ruleEngine.ts` and enforced by `INV-PLAN-NO-SESSIONS-ON-BLOCKED-DAYS` in `lib/plan/invariants.ts`. The parser accepts both short forms (`'mon'`) and full forms (`'monday'`) so the engine is robust to wizard, API, and test inputs.

---

## 19. Session label integrity — name matches prescribed physiology

**Principle.** A session's name carries physiological meaning. If a session is named "VO2max" the prescription MUST land in Z4–Z5 at I-pace (95–100% vVO2max). If it is named "Threshold" / "Tempo" / "Cruise" the prescription MUST land in Z3 at T-pace (83–88% vVO2max). If a session is named after a race distance ("10K-pace intervals", "HM-pace intervals") the prescription MUST land within ±2% of derived goal pace. If the engine cannot satisfy the label given the runner's VDOT, it MUST rename the session to one the prescription does satisfy.

**Why.** A non-elite runner cannot tell from feel whether 5:00/km is VO2max work, threshold, or 10K race pace — they trust the name on the card. Mislabelling trains the wrong system: prescribing T-pace under a "VO2max" label gives the runner threshold adaptations and the false belief they're doing VO2max work. The first time they meet true VO2max pace will be on race day or in a future plan, and it will hurt for the wrong reasons.

**Config.** No numeric — structural rule. Implemented by `makeQualitySession()` in `lib/plan/ruleEngine.ts` which dispatches on `catalogueRow.category`. Enforced by `INV-PLAN-LABEL-MATCHES-PACE` in `lib/plan/invariants.ts`. The `PaceGuide` interface carries `intervalPaceStr` (I-pace) and `qualityPaceStr` (T-pace) as separate bands so the engine can prescribe the correct one for each catalogue category.

---

## 20. VDOT surface — auditable, table-comparable

**Principle.** The VDOT surfaced on the plan (`meta.vdot`) MUST be the *raw* benchmark-derived value, not the conservatism-discounted training anchor. The discounted anchor is also surfaced, separately, as `meta.vdot_training_anchor`. The gap between the two is `meta.vdot_discount_applied_pct`. Goal pace (`meta.goal_pace_per_km`) is computed from `target_time / race_distance_km` directly — it is the runner's stated target, not a derived training pace.

**Why.** A user who runs a 23:30 5K opens Daniels' Running Formula and sees VDOT ~41. If Zona surfaces VDOT 40 (after a 3% discount) the user thinks the engine has miscalibrated their fitness. They lose trust. The discount is real and important — it produces the slow easy paces the brand exists to defend — but it lives in the *training paces*, not in the headline number. Surfacing both makes the engine's reasoning legible: "your benchmark gives VDOT 41; we're training at the 39.8 anchor for safety."

**Config.** No numeric — structural rule. Implemented in `generateRulePlan()` in `lib/plan/ruleEngine.ts` (raw and discounted both stored). Enforced by `INV-PLAN-VDOT-RAW-EXCEEDS-ANCHOR` in `lib/plan/invariants.ts`. The Daniels-Gilbert formula in `calcVDOT()` is intentionally conservative (~0.3 VDOT below his published 5K table at threshold race distances) — this is documented inertia from the published mathematics, not a bug; the table itself is interpolated.

---

## 21. Injury-aware session selection

**Principle.** `injury_history` modifies session *selection*, not just volume. During base and build phases, the engine MUST NOT prescribe hill repeats or steep-grade sessions to runners with knee, ITB, Achilles, shin, calf, or plantar history. Substitutes are progression runs or flat tempo at equivalent intensity. Peak phase may reintroduce hills only after a successful symptom-free build (a future paid feature; not yet wired).

**Why.** Hill repeats place loaded eccentric stress on the very tissues that are already symptomatic for these injury types — the knee under load on the descent, the Achilles at the top of each rep. The existing volume cap (5% week-on-week for knee/shin in §12) is necessary but insufficient; volume restraint cannot save a runner from inappropriate session *content*. The brand promise is "Slow down. You've got a day job." — a runner with a niggle still has both the niggle and the day job. The engine must respect both.

**Config.** `GENERATION_CONFIG.HILL_RESTRICTING_INJURIES = ['knee', 'itb', 'achilles', 'shin', 'calf', 'plantar']`. Catalogue rows tagged `main_set_structure.terrain === 'hills'` (or whose `id` contains `'hill'`) are excluded by `selectCatalogueSession()` when this filter applies. Enforced by `INV-PLAN-INJURY-NO-HILLS` in `lib/plan/invariants.ts`.

---

## 22. Race-specific exposure (time-targeted goals)

**Principle.** For `goal: time_target`, the runner needs sustained exposure to goal pace before race day. In the second half of the plan (weeks > ⌈total_weeks/2⌉), the engine MUST prescribe goal pace on the build/peak quality slot, with VO2max sessions exempt (their physiology is too valuable to lose). The session is renamed to a race-distance-specific label (e.g. "10K-pace intervals", "HM-pace intervals") and the prescription lands within ±2% of derived goal pace.

**Why.** A non-elite runner who has never run at goal pace in training will run their first goal-pace metres on race day. They will either go out at the wrong pace (because they don't know what it feels like) or fail to commit to it (because the pace feels alien). Specificity is the simplest fitness lever in coaching: if the race is at pace X, train at pace X. The brand promise is "training plans that stop you overtraining" — but a plan that's so cautious it never visits race pace is a plan that produces a race-day stranger to their target.

**Config.** No numeric — structural rule. Implemented in `buildWeekSessions()` (`lib/plan/ruleEngine.ts`) which sets `goalPaceWeek` when `weekN > ⌈totalWeeks/2⌉`, `goal === 'time_target'`, and the phase is build or peak. `makeQualitySession()` honours the flag by overriding label and pace prescription. Enforced by `INV-PLAN-RACE-SPECIFIC-EXPOSURE` in `lib/plan/invariants.ts`.

---

## 23. Peak overload requirement

**Principle.** A plan presented as a "build" must produce overload. For plans of `PEAK_OVERLOAD_MIN_PLAN_WEEKS` weeks or longer, peak weekly volume MUST be at least `PEAK_OVER_BASE_RATIO` times week 1 volume. If the engine cannot achieve this overload given the runner's constraints (`days_available`, `max_weekday_mins`, `current_weekly_km` already near peak target, injury caps), it MUST surface `volume_profile = 'maintenance'` with a `volume_constraint_note` explaining why. The plan still runs; the runner is informed of what it is and isn't.

**Why.** A plan whose peak equals its base is a maintenance plan, not a training plan. Selling it as a build is a trust violation: the runner expects to be fitter than they were when they started, and an honest engine says when that isn't possible. This case is most common when `current_weekly_km` is already close to the per-fitness-level target peak — there's nowhere to ramp to. Surfacing it lets the user adjust their inputs (e.g. spend a month consolidating before generating a build plan) instead of running a misleading 14-week loop.

**Config.**
- `GENERATION_CONFIG.PEAK_OVER_BASE_RATIO = 1.10`
- `GENERATION_CONFIG.PEAK_OVERLOAD_MIN_PLAN_WEEKS = 8`

Implemented in `generateRulePlan()` (`lib/plan/ruleEngine.ts`) which sets `plan.meta.volume_profile` and `plan.meta.volume_constraint_note` after week construction. Enforced by `INV-PLAN-PEAK-OVER-BASE` in `lib/plan/invariants.ts` — the invariant accepts either a passing ratio OR an explicit 'maintenance' classification.

---

## 24. Long-run race specificity (HM and marathon)

**Principle.** Time-targeted plans for HM and longer require race-distance specificity in the long run. For HM, peak long run MUST reach ≥85% of race distance; for marathon, ≥75%. Distances ≤10K have no such minimum (the long run is for aerobic development, not specificity). The absolute `LONG_RUN_CAP_MINUTES` ceiling per distance still wins — the engine never prescribes a long run that exceeds the time cap, even if doing so would satisfy this floor.

**Why.** A runner targeting a 1:55 HM who never runs a long run longer than 15 km will spend 6+ km of their race in genuinely unfamiliar territory. The fatigue profile of running for ~2 hours is fundamentally different from running for 100 minutes — pacing, fuelling, mental discipline. Without exposure to it in training, race day is a new experience. Daniels and Pfitzinger both prescribe long runs at 90–100% of race distance for HM specifically because of this. Capping at 15 km is a compressed-plan symptom; the principle exposes it as such.

**Config.** `GENERATION_CONFIG.PEAK_LR_RATIO_VS_RACE` — keyed by race distance:
```
HM       → 0.85  (≥17.9 km for a 21.1 km race)
MARATHON → 0.75  (≥31.7 km for a 42.2 km race)
```

Implemented in `buildWeekSessions()` peak-phase long-run sizing. The race-distance floor is applied between the early-week cap and the absolute time cap. Enforced by `INV-PLAN-PEAK-LR-RACE-RATIO` in `lib/plan/invariants.ts`.

---

## 25. Race-specific long run (HM and marathon, time-targeted)

**Principle.** Peak phase of a time-targeted HM or marathon plan MUST contain at least one long run with an embedded race-pace segment. The segment is the final 25–40% of the long run (the runner is already aerobically tired when they hit goal pace, simulating the late-race state). Naming convention: "Long run with HM-pace finish" for HM, "Marathon-pace long run" for marathon. Distances ≤10K do not require this — their long run remains aerobic.

**Why.** Threshold-pace cruise intervals teach pace discipline on fresh legs. Race-pace work on tired legs is a different adaptation: glycogen recruitment under fatigue, mental discipline at hour 1+, the specific feel of holding goal pace when easy pace would feel right. Daniels and Pfitzinger both call this the single most race-specific session for the HM and marathon. Without it, the runner has practised the pace and practised the duration but never together — and race day is the first time those two collide.

**Config.** Catalogue rows `hm_pace_long_run` (HM) and `mp_long_run` (marathon), both `category: 'race_specific'`. Selected in `buildWeekSessions()` peak-phase long-run path when `goal === 'time_target'` and the runner has a derivable goal pace. Implemented via `raceSpecificLongRunSession()`. Enforced by `INV-PLAN-RACE-SPECIFIC-LONG-RUN` in `lib/plan/invariants.ts`.

---

## 26. Race-week sharpening (not tempo)

**Principle.** In the final 7 days before race day (race week), any quality session MUST be a sharpening session — short reps at race pace or faster, with full recovery, total work volume ≤5 km. Continuous tempo, threshold intervals, progression runs, hill repeats, and long runs above 50% of peak long run distance are prohibited in race week. Permitted: 3–5×1 km at goal pace with ≥90s recovery, 6×400m at goal pace or slightly faster with ≥60s recovery, 4–6×100m strides appended to a shakeout.

**Why.** Detraining fitness gains take ~10 days; gaining fitness takes ~21. In the 7 days before a race, the runner can lose nothing important by NOT training hard, and they can lose everything (a fresh race-day) by training hard. Tempo and progression runs add fatigue without adding fitness — a directly negative trade. Sharpening reps preserve neuromuscular coordination and pace memory at minimal fatigue cost. The engine must never schedule a fatigue-adding session in race week.

**Config.** `GENERATION_CONFIG.TAPER_QUALITY_PER_WEEK[distance]` ends with `0` for race week across all distances. Enforced by `INV-PLAN-RACE-WEEK-SHARPENING` in `lib/plan/invariants.ts` — structural guard against future regression.

---

## 27. The constitution

These twenty-seven principles are the constitution. Every numeric the generator uses points back to one of them. If a numeric exists with no principle, it is a defect — either the numeric should be removed or the principle should be added.

If you are reviewing a plan that feels wrong, this is the document to read first. Find the principle that is failing. The fix lives in the config, never inline.
